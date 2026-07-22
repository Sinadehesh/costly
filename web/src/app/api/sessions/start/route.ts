import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDevice } from '@/lib/deviceAuth';

const bodySchema = z.object({
  appPackage: z.string().min(1), // e.g. "com.zhiliaoapp.musically"
});

/**
 * POST /api/sessions/start
 * Called by the Android companion the moment a target app hits the foreground.
 * Authenticated by x-device-secret; the user is derived from the device, never
 * the body. Refuses to arm if the user has no saved payment method — a meter
 * that can't charge is theater.
 */
export async function POST(req: Request) {
  const auth = await requireDevice(req);
  if (auth instanceof NextResponse) return auth;

  const body = bodySchema.parse(await req.json());

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
  if (!user.stripePaymentMethodId) {
    return NextResponse.json({ error: 'no_payment_method' }, { status: 409 });
  }
  // Phase 2: a locked account cannot open new billable sessions — the lockout
  // must hold server-side too, not only in the UI (the spy is always-on).
  if (user.accountStatus === 'PAYMENT_FAILED') {
    return NextResponse.json(
      { error: 'payment_required', settleUpUrl: user.settleUpUrl },
      { status: 402 },
    );
  }

  const existing = await prisma.session.findFirst({
    where: { userId: auth.userId, status: 'ACTIVE' },
  });
  if (existing) return NextResponse.json({ sessionId: existing.id, resumed: true });

  const session = await prisma.session.create({
    data: {
      userId: auth.userId,
      appPackage: body.appPackage,
      lastScrollEventAt: new Date(),
    },
  });

  return NextResponse.json({ sessionId: session.id, resumed: false });
}
