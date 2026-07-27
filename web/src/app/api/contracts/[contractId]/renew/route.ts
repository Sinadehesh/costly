import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/jwt';
import { MAX_DELETION_FEE_CENTS } from '@/lib/penalty';

const bodySchema = z.object({
  lockinDays: z.union([z.literal(7), z.literal(30)]),
  // Omit to carry the previous fee forward.
  deletionFeeCents: z.number().int().min(0).max(MAX_DELETION_FEE_CENTS).optional(),
  termsVersion: z.string().min(1),
});

/**
 * POST /api/contracts/:contractId/renew
 * Available once the previous lock-in has been served (ACTIVE-past-expiry
 * or COMPLETED). Renewal is a NEW contract row — each period keeps its own
 * fee and consent evidence — and the old one is closed out as COMPLETED.
 *
 * Requires a web session, and the contract must belong to that user —
 * otherwise anyone could re-arm a stranger's switch (and set its fee).
 */
export async function POST(req: Request, ctx: { params: Promise<{ contractId: string }> }) {
  const userId = await requireSession(req);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { contractId } = await ctx.params;
  const body = bodySchema.parse(await req.json());

  const previous = await prisma.commitmentContract.findUnique({
    where: { id: contractId },
  });

  // 404 (not 403) for someone else's contract: don't confirm it exists.
  if (!previous || previous.userId !== userId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

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

  const [, renewed] = await prisma.$transaction([
    prisma.commitmentContract.update({
      // userId in the filter so a concurrent ownership change can't slip through.
      where: { id: contractId, userId },
      data: { status: 'COMPLETED' },
    }),
    prisma.commitmentContract.create({
      data: {
        userId,
        deletionFeeCents: body.deletionFeeCents ?? previous.deletionFeeCents,
        lockinStartsAt: now,
        lockinEndsAt: new Date(now.getTime() + body.lockinDays * 86_400_000),
        acceptedAt: now,
        termsVersion: body.termsVersion,
      },
    }),
  ]);

  return NextResponse.json({
    contractId: renewed.id,
    lockinEndsAt: renewed.lockinEndsAt,
    deletionFeeCents: renewed.deletionFeeCents,
  });
}
