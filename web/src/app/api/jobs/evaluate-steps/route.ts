import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

/**
 * GET /api/jobs/evaluate-steps
 * THE DAILY LAZINESS PENALTY. Nightly Vercel Cron (see vercel.json), secured
 * with the same `Authorization: Bearer $CRON_SECRET` as the other jobs.
 *
 * For each user with step data for the day-that-just-ended and steps below
 * their goal, charges lazinessPenaltyCents off-session. It does NOT lock
 * accounts on failure — a declined charge emits payment_intent.payment_failed,
 * and the Phase 2 webhook handles the lockout (Failure Cascade).
 *
 * Conservative by design: only users who actually have a DailyActivity row for
 * the day are evaluated. No row (app killed, never synced) = no charge — we
 * punish laziness, not a sync failure.
 */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // The day that just ended (UTC). See the timezone caveat in the review note.
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - 1);
  const dayStr = day.toISOString().slice(0, 10); // YYYY-MM-DD, used in the key

  const rows = await prisma.dailyActivity.findMany({
    where: { day, penaltyEvaluatedAt: null },
    include: { user: true },
    take: 500,
  });

  const results: { userId: string; outcome: string }[] = [];

  for (const row of rows) {
    const { user } = row;

    const goalMet = row.steps >= user.dailyStepGoal;
    const unchargeable =
      user.accountStatus === 'PAYMENT_FAILED' || // already locked — don't pile on
      !user.stripePaymentMethodId ||
      user.lazinessPenaltyCents < 50; // below Stripe's minimum

    if (goalMet || unchargeable) {
      await markEvaluated(row.id, 0, null);
      results.push({ userId: user.id, outcome: goalMet ? 'goal_met' : 'skipped' });
      continue;
    }

    try {
      const intent = await stripe.paymentIntents.create(
        {
          customer: user.stripeCustomerId!,
          payment_method: user.stripePaymentMethodId!, // guaranteed by the unchargeable guard above
          currency: user.currency,
          amount: user.lazinessPenaltyCents,
          off_session: true,
          confirm: true,
          capture_method: 'automatic',
          metadata: { userId: user.id, kind: 'laziness', day: dayStr },
        },
        // ROCK-SOLID idempotency: penalty_{userId}_{YYYY-MM-DD}. A second cron
        // fire for the same day returns the SAME PaymentIntent, never a second
        // charge — even if it races the DB guard below.
        { idempotencyKey: `penalty_${user.id}_${dayStr}` },
      );
      await markEvaluated(row.id, user.lazinessPenaltyCents, intent.id);
      results.push({ userId: user.id, outcome: 'charged' });
    } catch (err) {
      // Failure Cascade: let the decline flow to payment_intent.payment_failed,
      // where the Phase 2 webhook locks the account. Still stamp evaluated so
      // we don't re-attempt tomorrow's run against today's row (the idempotency
      // key already prevents a duplicate charge regardless).
      const failedPiId = (err as Stripe.errors.StripeError).payment_intent?.id ?? null;
      await markEvaluated(row.id, user.lazinessPenaltyCents, failedPiId);
      results.push({ userId: user.id, outcome: 'charge_failed' });
    }
  }

  return NextResponse.json({ day: dayStr, evaluated: rows.length, results });
}

async function markEvaluated(id: string, chargeCents: number, piId: string | null) {
  await prisma.dailyActivity.update({
    where: { id },
    data: {
      penaltyEvaluatedAt: new Date(),
      penaltyChargeCents: chargeCents,
      ...(piId ? { stripePenaltyPaymentIntentId: piId } : {}),
    },
  });
}
