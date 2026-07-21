import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateDeviceSecret, sha256 } from '@/lib/deviceAuth';

const bodySchema = z.object({
  otp: z.string().regex(/^\d{6}$/),
  label: z.string().max(64).optional(),
});

/**
 * POST /api/device/link
 * Called by the Android client with the OTP the user read off their dashboard.
 * On a valid, unexpired OTP: creates a Device row (storing only the secret's
 * hash), consumes the OTP so it can't be replayed, and returns the raw
 * x-device-secret ONCE. The client stores it and sends it on every future call.
 */
export async function POST(req: Request) {
  const { otp, label } = bodySchema.parse(await req.json());

  const user = await prisma.user.findUnique({
    where: { deviceLinkOtpHash: sha256(otp) },
    select: { id: true, deviceLinkOtpExpiresAt: true },
  });
  if (!user || !user.deviceLinkOtpExpiresAt || user.deviceLinkOtpExpiresAt < new Date()) {
    return NextResponse.json({ error: 'invalid_or_expired_otp' }, { status: 401 });
  }

  const secret = generateDeviceSecret();
  const [device] = await prisma.$transaction([
    prisma.device.create({
      data: { userId: user.id, secretHash: sha256(secret), label },
    }),
    // Consume the OTP — single use.
    prisma.user.update({
      where: { id: user.id },
      data: { deviceLinkOtpHash: null, deviceLinkOtpExpiresAt: null },
    }),
  ]);

  // userId is returned for the client's read-only convenience (the dashboard
  // GET query); mutations authenticate by the secret, not this value.
  return NextResponse.json({ deviceSecret: secret, userId: user.id, deviceId: device.id });
}
