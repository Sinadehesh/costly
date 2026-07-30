import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, signSession } from '@/lib/jwt';
import { MIN_PASSWORD_LENGTH, hashPassword } from '@/lib/password';
import { generateDeviceSecret, sha256 } from '@/lib/deviceAuth';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  deviceLabel: z.string().max(64).optional(),
});

/**
 * POST /api/auth/register
 *
 * The opt-in alternative to Google. Google is the default on both surfaces
 * because it is one tap and needs no password anyone has to invent or recover;
 * this exists for people who would rather not hand Google another app, which is
 * a reasonable thing to want and cheap to support.
 *
 * Creates the account only. The contract terms arrive on the next request, to
 * /api/onboarding, authenticated by the cookie this sets.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: 'invalid_request',
        message: issue
          ? `${issue.path.join('.') || 'body'}: ${issue.message}`
          : 'Check the email and password.',
      },
      { status: 400 },
    );
  }
  const { email, password, deviceLabel } = parsed.data;
  const normalised = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, passwordHash: true },
  });

  // An address that already has a password belongs to somebody. Registering
  // over it would be account takeover, so send them to sign-in instead.
  if (existing?.passwordHash) {
    return NextResponse.json(
      {
        error: 'email_taken',
        message: 'That email already has an account. Sign in instead.',
      },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  // No password yet means either a Google-only account adding one, or a row
  // that predates auth. Either way, setting it is the right move.
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } })
    : await prisma.user.create({
        data: {
          email: normalised,
          passwordHash,
          hourlyRateCents: 0,
          penaltyRateCentsPerMin: 1,
        },
      });

  const body: Record<string, unknown> = { userId: user.id, email: user.email };

  if (deviceLabel !== undefined) {
    const secret = generateDeviceSecret();
    const device = await prisma.device.create({
      data: { userId: user.id, secretHash: sha256(secret), label: deviceLabel || null },
    });
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
