import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { newlyCrossedTiers, sessionPenaltyCents } from '@/lib/penalty';

const bodySchema = z.object({
  // Seconds of ACTIVE scrolling since the last heartbeat. The device is the
  // source of truth for idle detection: the AccessibilityService only counts
  // seconds backed by TYPE_VIEW_SCROLLED events within the idle window, so a
  // phone left face-up on TikTok while its owner sleeps reports 0.
  activeSecondsDelta: z.number().int().min(0).max(120),
  scrolledSinceLast: z.boolean(),
});

/**
 * POST /api/sessions/:sessionId/heartbeat
 * Sent by the companion service every ~30s while a session is ACTIVE.
 * Accumulates billable time and answers with the running total so the live
 * meter (web overlay/widget) and the device stay in sync.
 *
 * - capReached: true → the device must force-close the vice app and call /end.
 * - taunts: anchor items whose exact price the meter crossed since the last
 *   heartbeat — the device fires the hostile notification/overlay for each:
 *   "Thank you for buying us [Product Name]." Tracked via lastTauntTier so
 *   every tier taunts exactly once per session.
 */
export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const body = bodySchema.parse(await req.json());

  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { user: { include: { anchorItems: true } } },
  });
  if (session.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'session_not_active' }, { status: 409 });
  }

  const totalActiveSeconds = session.totalActiveSeconds + body.activeSecondsDelta;
  const { penaltyCents, capReached } = sessionPenaltyCents(
    totalActiveSeconds,
    session.user.penaltyRateCentsPerMin,
    session.user.sessionCapCents,
  );

  const crossed = newlyCrossedTiers(penaltyCents, session.lastTauntTier, session.user.anchorItems);
  const taunts = crossed.map((tier) => {
    const item = session.user.anchorItems.find((a) => a.tierLevel === tier.tierLevel)!;
    return {
      tierLevel: item.tierLevel,
      name: item.name,
      priceCents: item.priceCents,
      message: `Thank you for buying us ${item.name}.`,
    };
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      totalActiveSeconds,
      totalPenaltyCents: penaltyCents,
      capReached,
      ...(crossed.length > 0 ? { lastTauntTier: crossed[crossed.length - 1].tierLevel } : {}),
      ...(body.scrolledSinceLast ? { lastScrollEventAt: new Date() } : {}),
    },
  });

  // A session heartbeat is also proof of life for the dead man's switch.
  await prisma.user.update({
    where: { id: session.userId },
    data: { lastHeartbeatAt: new Date() },
  });

  return NextResponse.json({ totalActiveSeconds, penaltyCents, capReached, taunts });
}
