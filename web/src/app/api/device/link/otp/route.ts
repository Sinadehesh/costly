import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/jwt';
import { generateOtp, sha256 } from '@/lib/deviceAuth';

const OTP_TTL_MS = 5 * 60 * 1000; // short-lived by design

/**
 * POST /api/device/link/otp
 * Called by the authenticated WEB user (JWT session). Generates a short-lived
 * 6-digit OTP, stores only its hash + expiry on the user, and returns the code
 * for the dashboard to display. The Android client then exchanges it at
 * /api/device/link.
 */
export async function POST(req: Request) {
  const userId = await requireSession(req);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // deviceLinkOtpHash is @unique, so a code must resolve to at most one user.
  // Regenerate on the (rare) collision with a *different* user's active code.
  let otp = '';
  let hash = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    otp = generateOtp();
    hash = sha256(otp);
    const clash = await prisma.user.findUnique({
      where: { deviceLinkOtpHash: hash },
      select: { id: true },
    });
    if (!clash || clash.id === userId) break;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      deviceLinkOtpHash: hash,
      deviceLinkOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  return NextResponse.json({ otp, expiresInSeconds: OTP_TTL_MS / 1000 });
}
