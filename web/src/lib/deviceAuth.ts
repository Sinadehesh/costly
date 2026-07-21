import { createHash, randomBytes, randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Device authentication. Devices present an `x-device-secret` header; we store
 * only its SHA-256 hash (Device.secretHash), so a DB leak can't authenticate a
 * device. `requireDevice` is the route-level enforcement wrapper.
 *
 * Why a route wrapper and NOT Next.js Edge middleware: middleware runs on the
 * Edge runtime, where Prisma (the lookup we need to validate the secret and
 * resolve the user) isn't available without extra infra. So enforcement lives
 * in the Node route handlers, called at the top of each device endpoint.
 */

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** ~256-bit URL-safe secret, returned to the client once and never stored raw. */
export function generateDeviceSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** Cryptographically-random zero-padded 6-digit OTP. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export interface DeviceAuth {
  deviceId: string;
  userId: string;
}

/**
 * Validate the x-device-secret header. Returns the auth context, or a
 * NextResponse (401) the caller should return as-is:
 *
 *   const auth = await requireDevice(req);
 *   if (auth instanceof NextResponse) return auth;
 *   // ...use auth.userId
 */
export async function requireDevice(req: Request): Promise<DeviceAuth | NextResponse> {
  const secret = req.headers.get('x-device-secret');
  if (!secret) {
    return NextResponse.json({ error: 'missing_device_secret' }, { status: 401 });
  }

  const device = await prisma.device.findUnique({
    where: { secretHash: sha256(secret) },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!device || device.revokedAt) {
    return NextResponse.json({ error: 'invalid_device' }, { status: 401 });
  }

  // Best-effort liveness telemetry; never block the request on it.
  prisma.device
    .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return { deviceId: device.id, userId: device.userId };
}
