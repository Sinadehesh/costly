import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/dashboard?userId=...
 * One aggregate read for the Purgatory view: contract state, active holds
 * with their redemption tasks, walking-debt totals, and whether the
 * companion app has ever phoned home (armed vs unarmed).
 */
export async function GET(req: Request) {
  // TODO(auth): derive userId from the session, not the query string.
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'missing_userId' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      anchorItems: { orderBy: { tierLevel: 'asc' } },
      contracts: { where: { status: 'ACTIVE' }, take: 1 },
      sessions: {
        where: { status: 'HOLD' },
        include: { redemption: true },
        orderBy: { endTime: 'desc' },
      },
    },
  });
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const holds = user.sessions.map((s) => ({
    sessionId: s.id,
    appPackage: s.appPackage,
    endTime: s.endTime,
    totalPenaltyCents: s.totalPenaltyCents,
    burnCents: s.burnCents,
    purgatoryCents: s.purgatoryCents,
    redemption: s.redemption && {
      taskId: s.redemption.id,
      requiredWalkingMinutes: s.redemption.requiredWalkingMinutes,
      completedWalkingMinutes: s.redemption.completedWalkingMinutes,
      deadline: s.redemption.deadline,
      status: s.redemption.status,
    },
  }));

  const totals = holds.reduce(
    (acc, h) => {
      acc.purgatoryCents += h.purgatoryCents;
      if (h.redemption?.status === 'PENDING') {
        acc.requiredWalkingMinutes += h.redemption.requiredWalkingMinutes;
        acc.completedWalkingMinutes += Math.min(
          h.redemption.completedWalkingMinutes,
          h.redemption.requiredWalkingMinutes,
        );
      }
      return acc;
    },
    { purgatoryCents: 0, requiredWalkingMinutes: 0, completedWalkingMinutes: 0 },
  );

  // Lifetime money actually gone: every burn ever charged, plus every
  // purgatory hold that expired into a capture. Holds still in purgatory are
  // "at stake", not lost — they get their own number.
  const [burnAgg, capturedAgg] = await Promise.all([
    prisma.session.aggregate({
      _sum: { burnCents: true },
      where: { userId, status: { in: ['HOLD', 'RELEASED', 'CAPTURED'] } },
    }),
    prisma.session.aggregate({
      _sum: { purgatoryCents: true },
      where: { userId, status: 'CAPTURED' },
    }),
  ]);
  const lifetimeLostCents =
    (burnAgg._sum.burnCents ?? 0) + (capturedAgg._sum.purgatoryCents ?? 0);

  return NextResponse.json({
    user: {
      email: user.email,
      hourlyRateCents: user.hourlyRateCents,
      penaltyRateCentsPerMin: user.penaltyRateCentsPerMin,
      hasPaymentMethod: Boolean(user.stripePaymentMethodId),
      lastHeartbeatAt: user.lastHeartbeatAt,
      anchorItems: user.anchorItems,
    },
    contract: user.contracts[0]
      ? {
          id: user.contracts[0].id,
          deletionFeeCents: user.contracts[0].deletionFeeCents,
          lockinEndsAt: user.contracts[0].lockinEndsAt,
          status: user.contracts[0].status,
        }
      : null,
    holds,
    totals,
    lifetimeLostCents,
  });
}
