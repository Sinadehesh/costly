import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, signSession } from '@/lib/jwt';
import { verifyGoogleIdToken } from '@/lib/google';
import { generateDeviceSecret, sha256 } from '@/lib/deviceAuth';

const bodySchema = z.object({
  idToken: z.string().min(1),
  /**
   * Present when the Android companion is signing in. It gets a per-device
   * secret back, so the app holds a revocable credential of its own and never
   * has to re-authenticate through a browser.
   */
  deviceLabel: z.string().max(64).optional(),
});

/**
 * POST /api/auth/google
 *
 * Sign in with Google, for the web and the Android app alike. Both send a
 * verified ID token (Google Identity Services on the web, Credential Manager on
 * Android), which is why there is no redirect, no callback URL, and no step
 * where the user is told to go and finish signing in on a website.
 *
 * Account resolution, in order:
 *   1. Known googleId. Straightforward return visit.
 *   2. Known verified email with no googleId. Someone who signed up with a
 *      password is now using Google: link the two rather than colliding on the
 *      unique email, which would otherwise be an unrecoverable dead end.
 *   3. Neither. A brand-new person, pre-registered here so the client can save
 *      their contract terms in the very next request.
 *
 * Linking on email is only safe because verifyGoogleIdToken rejects
 * unverified addresses; without that check an attacker could claim an account
 * by asserting its address.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(parsed.data.idToken);
  } catch (err) {
    console.error('google id token rejected', err);
    return NextResponse.json(
      { error: 'invalid_google_token', message: 'Google sign-in could not be verified.' },
      { status: 401 },
    );
  }

  const existing =
    (await prisma.user.findUnique({ where: { googleId: identity.googleId } })) ??
    (await prisma.user.findUnique({ where: { email: identity.email } }));

  let user = existing;
  let created = false;

  if (!user) {
    // A placeholder rate: the real one arrives with the contract in the next
    // request. It exists only because the column is required, and the meter
    // cannot bill anyone until a card is vaulted anyway.
    user = await prisma.user.create({
      data: {
        email: identity.email,
        googleId: identity.googleId,
        hourlyRateCents: 0,
        penaltyRateCentsPerMin: 1,
      },
    });
    created = true;
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: identity.googleId },
    });
  }

  const body: Record<string, unknown> = {
    userId: user.id,
    email: user.email,
    created,
    // Lets the client skip straight to the dashboard for a returning user who
    // already has a contract and a card, instead of walking onboarding again.
    onboarded: user.stripePaymentMethodId !== null,
  };

  if (parsed.data.deviceLabel !== undefined) {
    const secret = generateDeviceSecret();
    const device = await prisma.device.create({
      data: {
        userId: user.id,
        secretHash: sha256(secret),
        label: parsed.data.deviceLabel || null,
      },
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
