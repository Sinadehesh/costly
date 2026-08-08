import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDevice } from '@/lib/deviceAuth';
import { freeSecondsRemaining, weeklyHeadroomCents } from '@/lib/penalty';
import { localCalendarDay } from '@/lib/localDay';
import { weeklySpentCents } from '@/lib/weeklySpend';

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

  // The weekly cap is a lockout, not a discount: once the week has cost what
  // the user said it may, the vice apps are shut for the rest of it rather
  // than billed further. Enforced here as well as on the device, because the
  // spy is always-on and the device is the thing we least control.
  const spent = await weeklySpentCents(auth.userId, user.timezone);
  if (weeklyHeadroomCents(spent, user.weeklyCapCents) <= 0) {
    return NextResponse.json(
      {
        error: 'weekly_cap_reached',
        weeklyCapCents: user.weeklyCapCents,
        spentCents: spent,
      },
      { status: 423 }, // Locked
    );
  }

  // How much grace is left TODAY, not for this session — the allowance is a
  // daily budget, so reopening the app does not top it back up. The device
  // needs it up front to render the free countdown before the first heartbeat.
  const day = localCalendarDay(new Date(), user.timezone);
  const dailyMeter = await prisma.dailyMeter.findUnique({
    where: { userId_day: { userId: auth.userId, day } },
    select: { activeSeconds: true },
  });
  const freeRemaining = freeSecondsRemaining(dailyMeter?.activeSeconds ?? 0, user.dailyFreeMinutes);

  const existing = await prisma.session.findFirst({
    where: { userId: auth.userId, status: 'ACTIVE' },
  });
  if (existing) {
    return NextResponse.json({
      sessionId: existing.id,
      resumed: true,
      billableSeconds: existing.billableSeconds,
      freeSecondsRemaining: freeRemaining,
    });
  }

  const session = await prisma.session.create({
    data: {
      userId: auth.userId,
      appPackage: body.appPackage,
      lastScrollEventAt: new Date(),
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    resumed: false,
    billableSeconds: 0,
    freeSecondsRemaining: freeRemaining,
  });
}
