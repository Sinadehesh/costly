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
