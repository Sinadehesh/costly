import { SignJWT, jwtVerify } from 'jose';

/**
 * Web-user session JWTs. Edge-compatible (jose, HS256) so this works in
 * middleware or route handlers on any runtime. This authenticates the WEB
 * user (who requests a device-link OTP); DEVICES authenticate separately via
 * the x-device-secret header (see lib/deviceAuth.ts). Two distinct trust paths.
 */

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const ISSUER = 'costly';
const AUDIENCE = 'costly-web';

export const SESSION_COOKIE = 'costly_session';

export async function signSession(userId: string, ttl: string = '30d'): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(ttl)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER, audience: AUDIENCE });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Returns the authenticated userId from a Bearer header or the session cookie, or null. */
export async function requireSession(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;

  const token = bearer ?? cookieToken;
  return token ? verifySession(token) : null;
}
