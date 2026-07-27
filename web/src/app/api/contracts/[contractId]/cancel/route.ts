import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/jwt';

/**
 * POST /api/contracts/:contractId/cancel
 * The free exit — but only after the lock-in period has been served.
 * Inside lock-in the only ways out are serving the time or eating the
 * deletion fee; that asymmetry is the entire point of the contract.
 * Cancelling disarms the dead man's switch (no ACTIVE contract → the
 * sweep ignores the user's heartbeats entirely).
 *
 * Requires a web session, and the contract must belong to that user — a
 * contractId is a bearer token otherwise, and cancelling someone else's
 * contract disarms their switch.
 */
export async function POST(req: Request, ctx: { params: Promise<{ contractId: string }> }) {
  const userId = await requireSession(req);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { contractId } = await ctx.params;

  const contract = await prisma.commitmentContract.findUnique({
    where: { id: contractId },
  });

  // 404 (not 403) for someone else's contract: don't confirm it exists.
  if (!contract || contract.userId !== userId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

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
    // userId in the filter so a concurrent ownership change can't slip through.
    where: { id: contractId, userId },
    data: { status: 'CANCELLED' },
  });

  return NextResponse.json({ status: updated.status });
}
