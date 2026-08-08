import { describe, expect, it } from 'vitest';
import { localWeekStart } from './localDay';

describe('localWeekStart', () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  it('returns Monday for every day of a week', () => {
    // 2026-08-03 is a Monday.
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(2026, 7, 3 + i, 12));
      expect(iso(localWeekStart(d, 'UTC'))).toBe('2026-08-03');
    }
  });

  it('rolls to the next Monday', () => {
    expect(iso(localWeekStart(new Date(Date.UTC(2026, 7, 10, 0, 1)), 'UTC'))).toBe('2026-08-10');
  });

  it('follows the user timezone, not UTC', () => {
    // 23:30 UTC Sunday is already Monday in Auckland.
    const d = new Date(Date.UTC(2026, 7, 9, 23, 30));
    expect(iso(localWeekStart(d, 'UTC'))).toBe('2026-08-03');
    expect(iso(localWeekStart(d, 'Pacific/Auckland'))).toBe('2026-08-10');
  });
});
