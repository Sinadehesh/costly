import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MAX_DAILY_FREE_MINUTES, MAX_DELETION_FEE_CENTS } from '@/lib/penalty';

const bodySchema = z.object({
  lockinDays: z.union([z.literal(7), z.literal(30)]),
  // Omit to carry the previous fee forward.
  deletionFeeCents: z.number().int().min(0).max(MAX_DELETION_FEE_CENTS).optional(),
  termsVersion: z.string().min(1),

  // Renewal is the ONLY moment the daily free allowance can move: it is sealed
  // for the duration of a contract, and this is where the next contract's
  // terms are chosen. Omit to carry the current allowance forward.
  dailyFreeMinutes: z.number().int().min(0).max(MAX_DAILY_FREE_MINUTES).optional(),
});

/**
 * POST /api/contracts/:contractId/renew
 * Available once the previous lock-in has been served (ACTIVE-past-expiry
 * or COMPLETED). Renewal is a NEW contract row — each period keeps its own
 * fee and consent evidence — and the old one is closed out as COMPLETED.
 */
export async function POST(req: Request, ctx: { params: Promise<{ contractId: string }> }) {
  // TODO(auth): verify the contract belongs to the authenticated user.
  const { contractId } = await ctx.params;
  const body = bodySchema.parse(await req.json());

  const previous = await prisma.commitmentContract.findUniqueOrThrow({
    where: { id: contractId },
  });

  const now = new Date();
  const served =
    previous.status === 'COMPLETED' ||
    (previous.status === 'ACTIVE' && previous.lockinEndsAt <= now);
  if (!served) {
    return NextResponse.json(
      { error: 'lockin_not_expired', lockinEndsAt: previous.lockinEndsAt },
      { status: 409 },
    );
  }

  // The allowance change rides in the same transaction as the new contract:
  // it must never be possible to loosen the meter and then have the contract
  // creation fail, leaving a softer setting with no term attached to it.
  const [, renewed, user] = await prisma.$transaction([
    prisma.commitmentContract.update({
      where: { id: contractId },
      data: { status: 'COMPLETED' },
    }),
    prisma.commitmentContract.create({
      data: {
        userId: previous.userId,
        deletionFeeCents: body.deletionFeeCents ?? previous.deletionFeeCents,
        lockinStartsAt: now,
        lockinEndsAt: new Date(now.getTime() + body.lockinDays * 86_400_000),
        acceptedAt: now,
        termsVersion: body.termsVersion,
      },
    }),
    prisma.user.update({
      where: { id: previous.userId },
      data:
        body.dailyFreeMinutes !== undefined ? { dailyFreeMinutes: body.dailyFreeMinutes } : {},
      select: { dailyFreeMinutes: true },
    }),
  ]);

  return NextResponse.json({
    contractId: renewed.id,
    lockinEndsAt: renewed.lockinEndsAt,
    deletionFeeCents: renewed.deletionFeeCents,
    dailyFreeMinutes: user.dailyFreeMinutes,
  });
}
