import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

/**
 * Password hashing on Node's built-in scrypt — no dependency, and scrypt is
 * memory-hard, which is the property that matters against GPU cracking.
 *
 * Stored as `scrypt$<salt-b64>$<hash-b64>` so the parameters travel with the
 * hash and can be rotated later without a migration.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, and a thrown error is itself a timing signal.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Minimum we'll accept. Length beats character-class theatre. */
export const MIN_PASSWORD_LENGTH = 8;
