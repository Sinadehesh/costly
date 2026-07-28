/** €-formatting for integer cents. UI-side twin of lib/penalty.ts. */

export function euros(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function eurosExact(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Android package → the name a human calls it.
 *
 * Taking the last dot-segment (the old approach) is actively wrong for the
 * exact apps this product exists to police: com.instagram.android reads as
 * "android" and com.zhiliaoapp.musically as "musically". A ledger of charges
 * has to name the app the user actually opened, or they cannot check it.
 */
const APP_NAMES: Record<string, string> = {
  'com.instagram.android': 'Instagram',
  'com.zhiliaoapp.musically': 'TikTok',
  'com.ss.android.ugc.trill': 'TikTok',
  'com.google.android.youtube': 'YouTube',
  'com.twitter.android': 'X',
  'com.x.android': 'X',
  'com.facebook.katana': 'Facebook',
  'com.reddit.frontpage': 'Reddit',
  'com.snapchat.android': 'Snapchat',
  'com.linkedin.android': 'LinkedIn',
  'com.pinterest': 'Pinterest',
  'com.netflix.mediaclient': 'Netflix',
  'com.whatsapp': 'WhatsApp',
  'org.telegram.messenger': 'Telegram',
};

export function appName(appPackage: string): string {
  const known = APP_NAMES[appPackage];
  if (known) return known;
  // Unknown package: the second segment is the vendor and is usually the
  // recognisable part ("com.foo.bar" → "Foo"), which beats the last segment.
  const parts = appPackage.split('.');
  const guess = parts.length >= 2 ? parts[1] : parts[0];
  return guess ? guess.charAt(0).toUpperCase() + guess.slice(1) : appPackage;
}

/** "2d 4h" / "3h 12m" / "12m" until a deadline; "expired" past it. */
export function timeLeft(deadline: string | Date, now = new Date()): string {
  const ms = new Date(deadline).getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}
