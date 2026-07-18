import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
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

  const [, renewed] = await prisma.$transaction([
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
  ]);

  return NextResponse.json({
    contractId: renewed.id,
    lockinEndsAt: renewed.lockinEndsAt,
    deletionFeeCents: renewed.deletionFeeCents,
  });
}
