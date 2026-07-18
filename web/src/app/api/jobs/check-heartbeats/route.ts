import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { isHeartbeatBreached } from '@/lib/penalty';

/**
 * GET /api/jobs/check-heartbeats
 * The dead man's switch trigger. Scheduled like expire-holds (Vercel Cron /
 * any cron with `Authorization: Bearer $CRON_SECRET`; see vercel.json).
 *
 * For every ACTIVE commitment contract:
 * - lock-in period over → COMPLETED (switch disarms, cancel flow unlocks).
 * - user.lastHeartbeatAt more than 24h old (2 consecutive missed 12h pings)
 *   → the user deleted the app or revoked its permissions mid-contract →
 *   BREACHED + off-session charge of the full deletion fee. A €0 fee still
 *   flips the status; it just charges nothing.
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

    if (!isHeartbeatBreached(contract.user.lastHeartbeatAt, now)) continue;

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
