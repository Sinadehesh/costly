import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  BREACH_AFTER_HOURS,
  BREACH_GRACE_HOURS,
  isBreachCured,
  isGraceExpired,
  isHeartbeatBreached,
  isHeartbeatWarning,
} from '@/lib/penalty';
import { heartbeatWarning, sendNotification } from '@/lib/notify';

/**
 * GET /api/jobs/check-heartbeats
 * The dead man's switch trigger. Scheduled like expire-holds (Vercel Cron /
 * any cron with `Authorization: Bearer $CRON_SECRET`; see vercel.json).
 *
 * For every ACTIVE commitment contract:
 * - lock-in period over → COMPLETED (switch disarms, cancel flow unlocks).
 * - silent ≥18h but under the threshold → send the warning email, once per
 *   episode of silence.
 * - silent >24h → the breach becomes PENDING. Nothing is charged yet.
 * - pending, and the device pinged since → CURED. The contract carries on.
 * - pending for longer than the grace window with continued silence →
 *   BREACHED + off-session charge of the full deletion fee. A €0 fee still
 *   flips the status; it just charges nothing.
 *
 * The two-stage breach exists because a dead battery, a holiday without a
 * charger, and an uninstall are indistinguishable from here. Charging on the
 * first observation of silence turns every flat phone into a chargeback; this
 * gives the user a warning and a way back.
 *
 * Users whose device has never pinged (onboarding done on web, app not yet
 * installed) have lastHeartbeatAt = null and are skipped — the switch arms
 * on the first ping.
 */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const contracts = await prisma.commitmentContract.findMany({
    where: { status: 'ACTIVE' },
    include: { user: true },
    take: 100,
  });

  const results: { contractId: string; outcome: string }[] = [];

  for (const contract of contracts) {
    if (contract.lockinEndsAt <= now) {
      await prisma.commitmentContract.update({
        where: { id: contract.id },
        data: { status: 'COMPLETED' },
      });
      results.push({ contractId: contract.id, outcome: 'completed' });
      continue;
    }

    const { user } = contract;

    // ── Rail 1: the 18h warning ──────────────────────────────────────────
    // Sent once per episode of silence; /api/device/heartbeat clears the
    // marker on every ping, so a later silence warns again.
    if (isHeartbeatWarning(user.lastHeartbeatAt, now) && !user.heartbeatWarningSentAt) {
      // Time until the card is actually charged: the 24h threshold plus the
      // grace window that follows it.
      const chargeAtMs =
        user.lastHeartbeatAt!.getTime() + (BREACH_AFTER_HOURS + BREACH_GRACE_HOURS) * 3600_000;
      const hoursLeft = Math.max(1, Math.round((chargeAtMs - now.getTime()) / 3600_000));
      const sent = await sendNotification(
        heartbeatWarning(user.email, contract.deletionFeeCents, hoursLeft),
      );
      // Only record it if it actually went out, so an unconfigured or failing
      // provider retries next sweep rather than silently swallowing the only
      // warning the user gets.
      if (sent) {
        await prisma.user.update({
          where: { id: user.id },
          data: { heartbeatWarningSentAt: now },
        });
      }
      results.push({ contractId: contract.id, outcome: sent ? 'warned' : 'warn_failed' });
      continue;
    }

    // ── Rail 2: reinstall-to-cure ────────────────────────────────────────
    if (contract.breachPendingSince) {
      if (isBreachCured(user.lastHeartbeatAt, contract.breachPendingSince)) {
        // The device came back. Stand down.
        await prisma.commitmentContract.update({
          where: { id: contract.id },
          data: { breachPendingSince: null },
        });
        results.push({ contractId: contract.id, outcome: 'cured' });
        continue;
      }
      if (!isGraceExpired(contract.breachPendingSince, now)) {
        // Still inside the grace window — give them the remaining time.
        results.push({ contractId: contract.id, outcome: 'pending_grace' });
        continue;
      }
      // Grace expired with continued silence → fall through and charge.
    } else {
      if (!isHeartbeatBreached(user.lastHeartbeatAt, now)) continue;
      // First observation of the threshold: mark pending, charge nothing yet.
      await prisma.commitmentContract.update({
        where: { id: contract.id },
        data: { breachPendingSince: now },
      });
      results.push({ contractId: contract.id, outcome: 'breach_pending' });
      continue;
    }

    try {
      let breachIntentId: string | null = null;
      if (contract.deletionFeeCents > 0) {
        const intent = await stripe.paymentIntents.create(
          {
            customer: contract.user.stripeCustomerId!,
            payment_method: contract.user.stripePaymentMethodId!,
            currency: contract.user.currency,
            amount: contract.deletionFeeCents,
            off_session: true,
            confirm: true,
            capture_method: 'automatic',
            metadata: { contractId: contract.id, userId: contract.userId, kind: 'deletion_fee' },
          },
          // Idempotent per contract: a crash between charge and DB write
          // cannot double-charge on the next sweep.
          { idempotencyKey: `breach_${contract.id}` },
        );
        breachIntentId = intent.id;
      }

      await prisma.commitmentContract.update({
        where: { id: contract.id },
        data: {
          status: 'BREACHED',
          breachedAt: now,
          stripeBreachPaymentIntentId: breachIntentId,
          breachPendingSince: null, // resolved — no longer pending
        },
      });
      results.push({ contractId: contract.id, outcome: 'breached' });
    } catch (err) {
      // Card declined / SCA required: leave ACTIVE for the next sweep and
      // let webhook reconciliation + a dunning flow (TODO) chase it.
      console.error(`check-heartbeats: breach charge failed for ${contract.id}`, err);
      results.push({ contractId: contract.id, outcome: 'charge_failed' });
    }
  }

  return NextResponse.json({ checked: contracts.length, results });
}
