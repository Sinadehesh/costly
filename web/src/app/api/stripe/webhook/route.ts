import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/stripe/webhook
 * Reconciliation backstop. The API routes drive state optimistically; this
 * handler makes the DB agree with what Stripe actually did, and it is the
 * only writer for saved payment methods (setup_intent.succeeded) and for
 * account lockout (Phase 2).
 *
 * Events to enable in the Stripe dashboard:
 *   setup_intent.succeeded, payment_intent.succeeded,
 *   payment_intent.canceled, payment_intent.payment_failed,
 *   invoice.payment_failed, invoice.payment_succeeded
 */

/** Lock an account into the "Settle Up" state. */
async function markPaymentFailed(opts: {
  userId?: string | null;
  customerId?: string | null;
  settleUpUrl?: string | null;
}) {
  const where = opts.userId
    ? { id: opts.userId }
    : opts.customerId
      ? { stripeCustomerId: opts.customerId }
      : null;
  if (!where) return;
  await prisma.user.updateMany({
    where,
    data: {
      accountStatus: 'PAYMENT_FAILED',
      paymentFailedAt: new Date(),
      ...(opts.settleUpUrl ? { settleUpUrl: opts.settleUpUrl } : {}),
    },
  });
}

/** Recovery: a payment cleared, so lift the lockout (only if it was locked). */
async function markPaymentRecovered(opts: { userId?: string | null; customerId?: string | null }) {
  const base = opts.userId
    ? { id: opts.userId }
    : opts.customerId
      ? { stripeCustomerId: opts.customerId }
      : null;
  if (!base) return;
  await prisma.user.updateMany({
    where: { ...base, accountStatus: 'PAYMENT_FAILED' },
    data: { accountStatus: 'ACTIVE', paymentFailedAt: null, settleUpUrl: null },
  });
}
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'no_signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  // Idempotency: first delivery wins, retries no-op.
  try {
    await prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case 'setup_intent.succeeded': {
      const si = event.data.object;
      const userId = si.metadata?.userId;
      if (userId && typeof si.payment_method === 'string') {
        await prisma.user.update({
          where: { id: userId },
          data: { stripePaymentMethodId: si.payment_method },
        });
      }
      break;
    }
    case 'payment_intent.canceled': {
      // Purgatory hold released — make sure the session says so.
      const pi = event.data.object;
      await prisma.session.updateMany({
        where: { stripePurgatoryPaymentIntentId: pi.id, status: 'HOLD' },
        data: { status: 'RELEASED' },
      });
      break;
    }
    case 'payment_intent.succeeded': {
      // Purgatory capture confirmed (burn captures also land here; the
      // updateMany filter scopes to purgatory intents only).
      const pi = event.data.object;
      await prisma.session.updateMany({
        where: { stripePurgatoryPaymentIntentId: pi.id, status: 'HOLD' },
        data: { status: 'CAPTURED' },
      });
      // Any successful charge lifts a Settle Up lockout for that user.
      await markPaymentRecovered({
        userId: pi.metadata?.userId,
        customerId: typeof pi.customer === 'string' ? pi.customer : null,
      });
      break;
    }
    case 'payment_intent.payment_failed': {
      // An off-session charge (session burn/purgatory, or a breach fee) was
      // declined / needs SCA → lock the account into Settle Up.
      const pi = event.data.object;
      console.error(`payment failed for intent ${pi.id}`, pi.last_payment_error?.code);
      await markPaymentFailed({
        userId: pi.metadata?.userId,
        customerId: typeof pi.customer === 'string' ? pi.customer : null,
        // A bare PaymentIntent has no hosted invoice URL; see the invoice
        // cases below for the resolvable link.
      });
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      await markPaymentFailed({
        customerId: typeof invoice.customer === 'string' ? invoice.customer : null,
        settleUpUrl: invoice.hosted_invoice_url ?? null,
      });
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      await markPaymentRecovered({
        customerId: typeof invoice.customer === 'string' ? invoice.customer : null,
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
