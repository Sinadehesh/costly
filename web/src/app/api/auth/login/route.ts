import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, signSession } from '@/lib/jwt';
import { verifyPassword } from '@/lib/password';
import { generateDeviceSecret, sha256 } from '@/lib/deviceAuth';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /**
   * Present when the Android companion is signing in. It gets a per-device
   * secret back instead of (as well as) a cookie — the app never stores the
   * password, and a stolen device secret is revocable on its own without
   * touching the account.
   */
  deviceLabel: z.string().max(64).optional(),
});

/**
 * POST /api/auth/login
 *
 * Ordinary email + password sign-in, for both surfaces.
 *
 * This replaces the 6-digit pairing code the companion used to require. That
 * pattern belongs to devices that cannot take input — TVs, consoles — and
 * makes no sense on a phone with a keyboard: it asked the user to transcribe a
 * number between two of their own devices to log in to their own account.
 * The per-device secret underneath was the good part and it stays; only the
 * bootstrap changes, from "read a code off another screen" to "sign in".
 *
 * It also closes a real hole: with onboarding sealed during a lock-in, a user
 * whose session cookie expired had no way back into their own dashboard.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { email, password, deviceLabel } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok) {
    // One message for "no such account" and "wrong password" alike: telling
    // them apart hands an attacker a free account-enumeration oracle.
    return NextResponse.json(
      { error: 'invalid_credentials', message: 'Wrong email or password.' },
      { status: 401 },
    );
  }

  const body: Record<string, unknown> = { userId: user.id };

  if (deviceLabel !== undefined) {
    const secret = generateDeviceSecret();
    const device = await prisma.device.create({
      data: { userId: user.id, secretHash: sha256(secret), label: deviceLabel || null },
    });
    // Returned exactly once and never stored raw on our side.
    body.deviceSecret = secret;
    body.deviceId = device.id;
  }

  const res = NextResponse.json(body);
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
