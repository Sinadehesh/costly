import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { requireDevice } from '@/lib/deviceAuth';

/**
 * POST /api/stripe/create-checkout
 * Device-authenticated. For a user in the PAYMENT_FAILED lockout, mints a
 * one-time Stripe Checkout Session to collect the penalty, and returns its
 * hosted URL for the Android app to open.
 *
 * The metadata is the bridge to recovery: userId is stamped on BOTH the
 * session and the resulting PaymentIntent, so the existing Phase 2 webhook
 * flips the account back to ACTIVE — via payment_intent.succeeded
 * (payment_intent_data.metadata.userId) AND checkout.session.completed
 * (session.metadata.userId). No new lockout/recovery logic here.
 */
export async function POST(req: Request) {
  const auth = await requireDevice(req);
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
  if (user.accountStatus !== 'PAYMENT_FAILED') {
    return NextResponse.json({ error: 'not_locked' }, { status: 409 });
  }
  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: 'no_customer' }, { status: 409 });
  }

  // Per spec, the outstanding amount is the laziness penalty; floored at
  // Stripe's €0.50 minimum. (A fuller version would sum the actual failed
  // charges — see the review note.)
  const amount = Math.max(user.lazinessPenaltyCents, 50);
  const baseUrl = process.env.APP_BASE_URL ?? new URL(req.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment', // one-time
    customer: user.stripeCustomerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: user.currency,
          unit_amount: amount,
          product_data: { name: 'Costly — settle up your penalty' },
        },
      },
    ],
    metadata: { userId: user.id, kind: 'settle_up' },
    payment_intent_data: { metadata: { userId: user.id, kind: 'settle_up' } },
    success_url: `${baseUrl}/settle-up?status=success`,
    cancel_url: `${baseUrl}/settle-up?status=cancelled`,
  });

  // Persist so the URL is reusable (dashboard / re-open) until it's paid.
  await prisma.user.update({
    where: { id: user.id },
    data: { settleUpUrl: session.url },
  });

  return NextResponse.json({ url: session.url });
}
