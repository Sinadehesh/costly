import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

const BUFFER_HOUR = 2; // only charge a local day once it's past 02:00 the next day

/**
 * GET /api/jobs/evaluate-steps
 * THE DAILY LAZINESS PENALTY. Vercel Cron (see vercel.json), secured with the
 * same `Authorization: Bearer $CRON_SECRET` as the other jobs.
 *
 * Timezone-safe: a user's step-day is charged ONLY once that day has safely
 * concluded in THEIR local timezone (past 02:00 the following morning), so no
 * one is billed before their day is actually over. The evaluation is
 * idempotent and self-healing, so the cron can run at any cadence — hourly is
 * scheduled so every timezone is evaluated shortly after its local 02:00,
 * rather than a single UTC nightly run that would delay half the world by a day.
 *
 * Conservative by design: only users who actually have a DailyActivity row are
 * evaluated. No row (app killed, never synced) = no charge — we punish
 * laziness, not a sync failure. Failure Cascade: a decline is NOT handled here;
 * it flows to payment_intent.payment_failed and the Phase 2 webhook locks.
 */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  // Bounded scan: any recent un-evaluated day. The per-user buffer check below
  // decides which are actually concluded; older rows self-heal on later runs.
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 4);
  windowStart.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.dailyActivity.findMany({
    where: { penaltyEvaluatedAt: null, day: { gte: windowStart } },
    include: { user: true },
    take: 500,
  });

  const results: { userId: string; outcome: string }[] = [];

  for (const row of rows) {
    const { user } = row;

    // Skip until this row's local day has safely concluded in the user's tz.
    if (row.day > mostRecentEvaluableDay(now, user.timezone)) {
      results.push({ userId: user.id, outcome: 'not_yet_concluded' });
      continue;
    }

    const dayStr = row.day.toISOString().slice(0, 10); // the local calendar day
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
        // ROCK-SOLID idempotency: penalty_{userId}_{YYYY-MM-DD} (the user's
        // LOCAL day). A second fire for the same day returns the SAME
        // PaymentIntent, never a second charge — even racing the DB guard.
        { idempotencyKey: `penalty_${user.id}_${dayStr}` },
      );
      await markEvaluated(row.id, user.lazinessPenaltyCents, intent.id);
      results.push({ userId: user.id, outcome: 'charged' });
    } catch (err) {
      // Failure Cascade: let the decline flow to payment_intent.payment_failed,
      // where the Phase 2 webhook locks the account. Still stamp evaluated so
      // we don't re-attempt (the idempotency key also prevents a duplicate).
      const failedPiId = (err as Stripe.errors.StripeError).payment_intent?.id ?? null;
      await markEvaluated(row.id, user.lazinessPenaltyCents, failedPiId);
      results.push({ userId: user.id, outcome: 'charge_failed' });
    }
  }

  return NextResponse.json({ evaluated: rows.length, results });
}

/**
 * The most recent local calendar day (as a UTC-midnight Date, matching how
 * DailyActivity.day is stored) that has safely concluded for this timezone.
 *
 * We never convert a wall-clock time in an arbitrary tz to a UTC instant —
 * that's the hard, DST-fragile part. Instead we ask Intl for the user's
 * CURRENT local date + hour (Intl applies the correct offset incl. DST), then:
 *   - if it's already past 02:00 local, yesterday-local fully ended 2h+ ago
 *     → evaluable is (localToday − 1);
 *   - if it's still before 02:00 local, yesterday-local hasn't cleared the
 *     buffer yet → evaluable is (localToday − 2).
 * A row is charged only when row.day <= this value.
 */
function mostRecentEvaluableDay(now: Date, timeZone: string): Date {
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
  // Ingestion validates tz, but never trust it at charge time — fall back to UTC.
  const parts = (() => {
    try {
      return format(timeZone);
    } catch {
      return format('UTC');
    }
  })();
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);

  const localTodayUtcMidnight = Date.UTC(get('year'), get('month') - 1, get('day'));
  const offsetDays = get('hour') >= BUFFER_HOUR ? 1 : 2;
  return new Date(localTodayUtcMidnight - offsetDays * 86_400_000);
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
