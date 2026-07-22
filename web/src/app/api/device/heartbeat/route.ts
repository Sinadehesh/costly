import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDevice } from '@/lib/deviceAuth';

const bodySchema = z.object({
  // Self-reported diagnostics — useful for support disputes ("the app was
  // installed, Android just killed the service"). Informational only; the
  // breach decision rests solely on ping recency.
  accessibilityEnabled: z.boolean().optional(),
  appVersion: z.string().optional(),
});

/**
 * POST /api/device/heartbeat
 * The dead man's switch lifeline. The companion app schedules this ping
 * every 12h (WorkManager with battery-optimization exemption requested —
 * Doze can delay workers, so the app should also ping opportunistically on
 * every launch and every session event). The breach sweep fires only after
 * 2 consecutive missed pings (>24h of silence) during an active lock-in.
 */
export async function POST(req: Request) {
  const auth = await requireDevice(req);
  if (auth instanceof NextResponse) return auth;

  // Body is now diagnostics-only; parse to validate shape (and reject junk).
  bodySchema.parse(await req.json());

  // Record proof-of-life FIRST — a payment-failed user is still present (not
  // deleted), so the dead man's switch must not also breach them for silence.
  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: { lastHeartbeatAt: new Date() },
    include: { anchorItems: { orderBy: { tierLevel: 'asc' } } },
  });

  // Phase 2 lockout: a failed off-session charge hard-blocks the device until
  // the account is settled. The client catches this 402 → "Settle Up" state.
  if (user.accountStatus === 'PAYMENT_FAILED') {
    return NextResponse.json(
      { error: 'payment_required', settleUpUrl: user.settleUpUrl },
      { status: 402 },
    );
  }

  const activeContract = await prisma.commitmentContract.findFirst({
    where: { userId: auth.userId, status: 'ACTIVE' },
    select: { id: true, lockinEndsAt: true, deletionFeeCents: true },
  });

  // Tell the device where it stands (contract state for the arming UI) and
  // ship the meter config: the live overlay ticks locally every second, so
  // it needs the rate and the hostage ladder on-device, refreshed each ping.
  return NextResponse.json({
    ok: true,
    contract: activeContract,
    penaltyRateCentsPerMin: user.penaltyRateCentsPerMin,
    anchorItems: user.anchorItems.map((a) => ({
      name: a.name,
      priceCents: a.priceCents,
      tierLevel: a.tierLevel,
    })),
  });
}
