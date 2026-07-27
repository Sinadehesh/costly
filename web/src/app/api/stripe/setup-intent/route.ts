import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/jwt';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/stripe/setup-intent
 * Returns a SetupIntent client_secret so the frontend (Stripe Elements) can
 * save a card for later OFF-SESSION charges. usage: "off_session" is what
 * lets us create the burn + purgatory PaymentIntents while the user is out
 * walking (or asleep) — and is what makes SCA/3DS exemptions possible for
 * merchant-initiated transactions in the EU.
 *
 * The saved payment method id is written back to User by the webhook
 * handler on setup_intent.succeeded.
 *
 * The user comes from the session cookie (set by /api/onboarding), never from
 * the body — a userId in the body let anyone vault a card against another
 * account's Stripe customer.
 */
export async function POST(req: Request) {
  const userId = await requireSession(req);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const setupIntent = await stripe.setupIntents.create({
    customer: user.stripeCustomerId!,
    usage: 'off_session',
    metadata: { userId },
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
