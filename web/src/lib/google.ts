import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Google ID token verification.
 *
 * Both surfaces send an ID TOKEN, not an auth code: the web uses Google
 * Identity Services and Android uses Credential Manager, and both hand back a
 * signed JWT directly. That means no redirect flow, no callback URL, and
 * critically no "go to the website to finish signing in" step, which is the
 * thing we are removing.
 *
 * Verified against Google's published keys with jose (already a dependency).
 * Never trust an unverified ID token: the whole payload is attacker-controlled
 * until the signature and the audience both check out.
 */

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleIdentity {
  googleId: string; // the `sub` claim: stable, and the thing to key on
  email: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Audiences we accept. The web client and the Android client are separate OAuth
 * clients with different IDs, so both have to be allowed — and only these, or
 * a token minted for any other Google app would be accepted as ours.
 */
function allowedAudiences(): string[] {
  return [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_ANDROID_CLIENT_ID].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const audience = allowedAudiences();
  if (audience.length === 0) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUERS, audience });

  const googleId = typeof payload.sub === 'string' ? payload.sub : null;
  const email = typeof payload.email === 'string' ? payload.email : null;
  if (!googleId || !email) throw new Error('id token is missing sub or email');

  // An unverified address must not be able to claim an existing account: we key
  // on it to link Google to a user who signed up with a password.
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (!emailVerified) throw new Error('google email is not verified');

  return {
    googleId,
    email: email.toLowerCase(),
    emailVerified,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}
