import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { requireDevice } from '@/lib/deviceAuth';
import {
  REDEMPTION_WINDOW_HOURS,
  applyWeeklyCap,
  requiredWalkingMinutes,
  splitPenalty,
} from '@/lib/penalty';
import { weeklySpentCents } from '@/lib/weeklySpend';

/**
 * POST /api/sessions/:sessionId/end
 * The financial moment. Called when the vice app leaves the foreground for
 * good (or the cap forces closure).
 *
 * Stripe reality check: ONE PaymentIntent cannot capture 20% and keep 80%
 * on hold — partial capture auto-releases the remainder. So we create TWO
 * off-session PaymentIntents against the saved card:
 *
 *   1. burn PI       — 20%, capture_method: automatic → charged immediately.
 *   2. purgatory PI  — 80%, capture_method: manual    → pre-auth hold.
 *      Cancelled if the walk is completed in 24h; captured by the expiry
 *      job if not. (Auth holds live 7 days on most cards, so 24h is safe.)
 */
export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const auth = await requireDevice(req);
  if (auth instanceof NextResponse) return auth;

  const { sessionId } = await ctx.params;

  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { user: true },
  });
  if (session.userId !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (session.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'session_not_active' }, { status: 409 });
  }

  const endTime = new Date();
  const { user } = session;

  // The weekly cap binds here too. Starting a session checks headroom, but a
  // single long session can run past it, so the amount actually charged is
  // clamped to what is left of the week. Never bill past the cap.
  const spent = await weeklySpentCents(user.id, user.timezone, endTime);
  const { chargeableCents } = applyWeeklyCap(
    session.totalPenaltyCents,
    spent,
    user.weeklyCapCents,
  );

  // Below Stripe's €0.50 minimum there is nothing chargeable — close free.
  // The cap can produce this too: a week with 30 cents of headroom left owes
  // nothing collectable, and trying would only pay Stripe a fixed fee.
  if (chargeableCents < 50) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { endTime, status: 'RELEASED' },
    });
    return NextResponse.json({ status: 'RELEASED', totalPenaltyCents: 0 });
  }

  const { burnCents, purgatoryCents } = splitPenalty(chargeableCents);

  const common = {
    customer: user.stripeCustomerId!,
    payment_method: user.stripePaymentMethodId!,
    currency: user.currency,
    off_session: true as const,
    confirm: true,
    metadata: { sessionId, userId: user.id },
  };

  /**
   * Off-session confirms fail routinely in the EU: SCA sends back
   * `authentication_required`, and cards decline. Throwing here left the
   * session ACTIVE forever with a burn possibly already charged, and the
   * device retrying the same end call against a half-finished state.
   *
   * Both intents carry idempotency keys, so a retry after a transient failure
   * returns the original intent rather than charging twice. A hard failure
   * flips the account into PAYMENT_FAILED, which /api/sessions/start already
   * refuses to arm against, and the Settle Up flow already knows how to clear.
   */
  let burnIntent;
  let purgatoryIntent;
  try {
    burnIntent = await stripe.paymentIntents.create(
      { ...common, amount: burnCents, capture_method: 'automatic' },
      { idempotencyKey: `burn_${sessionId}` },
    );
    purgatoryIntent = await stripe.paymentIntents.create(
      { ...common, amount: purgatoryCents, capture_method: 'manual' },
      { idempotencyKey: `purgatory_${sessionId}` },
    );
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'charge_failed';
    const declineCode = (err as { decline_code?: string }).decline_code;

    // Close the session rather than leaving it ACTIVE: the meter must stop.
    // The amount owed is recorded, so Settle Up can collect it later; what is
    // NOT recorded is a hold that was never placed.
    await prisma.$transaction([
      prisma.session.update({
        where: { id: sessionId },
        data: {
          endTime,
          status: 'CHARGE_FAILED',
          burnCents,
          purgatoryCents,
          chargeFailureCode: declineCode ?? code,
          // A burn that did land is still recorded — the retry is idempotent,
          // so Settle Up must not collect it a second time.
          stripeBurnPaymentIntentId: burnIntent?.id ?? null,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { accountStatus: 'PAYMENT_FAILED' },
      }),
    ]);

    return NextResponse.json(
      {
        status: 'CHARGE_FAILED',
        error: 'payment_required',
        code: declineCode ?? code,
        totalPenaltyCents: session.totalPenaltyCents,
      },
      { status: 402 },
    );
  }

  const deadline = new Date(endTime.getTime() + REDEMPTION_WINDOW_HOURS * 3600_000);

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      endTime,
      status: 'HOLD',
      burnCents,
      purgatoryCents,
      stripeBurnPaymentIntentId: burnIntent.id,
      stripePurgatoryPaymentIntentId: purgatoryIntent.id,
      redemption: {
        create: {
          // Billable, not detected: seconds covered by the daily free
          // allowance owe no walk, the same way they owed no money.
          requiredWalkingMinutes: requiredWalkingMinutes(session.billableSeconds),
          deadline,
        },
      },
    },
    include: { redemption: true },
  });

  return NextResponse.json({
    status: updated.status,
    totalPenaltyCents: updated.totalPenaltyCents,
    burnCents,
    purgatoryCents,
    redemption: updated.redemption,
  });
}
