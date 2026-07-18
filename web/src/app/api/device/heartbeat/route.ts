import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const bodySchema = z.object({
  userId: z.string(),
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
  // TODO(auth): verify DEVICE_API_SECRET header from the companion service.
  const body = bodySchema.parse(await req.json());

  const user = await prisma.user.update({
    where: { id: body.userId },
    data: { lastHeartbeatAt: new Date() },
    include: { anchorItems: { orderBy: { tierLevel: 'asc' } } },
  });

  const activeContract = await prisma.commitmentContract.findFirst({
    where: { userId: body.userId, status: 'ACTIVE' },
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
