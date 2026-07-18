import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/contracts/:contractId/cancel
 * The free exit — but only after the lock-in period has been served.
 * Inside lock-in the only ways out are serving the time or eating the
 * deletion fee; that asymmetry is the entire point of the contract.
 * Cancelling disarms the dead man's switch (no ACTIVE contract → the
 * sweep ignores the user's heartbeats entirely).
 */
export async function POST(_req: Request, ctx: { params: Promise<{ contractId: string }> }) {
  // TODO(auth): verify the contract belongs to the authenticated user.
  const { contractId } = await ctx.params;

  const contract = await prisma.commitmentContract.findUniqueOrThrow({
    where: { id: contractId },
  });

  if (contract.status !== 'ACTIVE' && contract.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'contract_not_cancellable' }, { status: 409 });
  }
  if (contract.status === 'ACTIVE' && contract.lockinEndsAt > new Date()) {
    return NextResponse.json(
      { error: 'lockin_not_expired', lockinEndsAt: contract.lockinEndsAt },
      { status: 409 },
    );
  }

  const updated = await prisma.commitmentContract.update({
    where: { id: contractId },
    data: { status: 'CANCELLED' },
  });

  return NextResponse.json({ status: updated.status });
}
