import { describe, expect, it } from 'vitest';

import {
  ANCHOR_TIER_COUNT,
  DEFAULT_WEEKLY_CAP_CENTS,
  MAX_WEEKLY_CAP_CENTS,
  MIN_WEEKLY_CAP_CENTS,
  applyWeeklyCap,
  weeklyHeadroomCents,
  BREACH_AFTER_HOURS,
  BREACH_GRACE_HOURS,
  BURN_SHARE,
  HEARTBEAT_WARNING_AFTER_HOURS,
  MAX_DAILY_FREE_MINUTES,
  MAX_DELETION_FEE_CENTS,
  REDEMPTION_WINDOW_HOURS,
  SWEAT_RATIO,
  anchorPercent,
  freeSecondsRemaining,
  isBreachCured,
  isGraceExpired,
  isHeartbeatBreached,
  isHeartbeatWarning,
  newlyCrossedTiers,
  perMinuteRateCents,
  requiredWalkingMinutes,
  sessionPenaltyCents,
  splitDailyFree,
  splitPenalty,
} from './penalty';

/**
 * This module decides how much real money leaves a real card, so the tests
 * lean on the invariants rather than a handful of happy paths: cents never
 * appear or vanish in the split, the cap is never exceeded, and nothing
 * returns a fraction of a cent.
 */

describe('perMinuteRateCents', () => {
  it('divides an hourly rate into minutes', () => {
    expect(perMinuteRateCents(6000)).toBe(100); // €60/h → €1.00/min
    expect(perMinuteRateCents(3000)).toBe(50);
  });

  it('never returns 0 — a free minute would make the whole product pointless', () => {
    expect(perMinuteRateCents(0)).toBe(1);
    expect(perMinuteRateCents(1)).toBe(1);
    expect(perMinuteRateCents(29)).toBe(1); // rounds to 0, floored to 1
  });

  it('returns whole cents for rates that do not divide evenly', () => {
    const rate = perMinuteRateCents(3050); // 50.83…
    expect(Number.isInteger(rate)).toBe(true);
    expect(rate).toBe(51);
  });
});

describe('splitPenalty', () => {
  it('splits 20/80 on a clean amount', () => {
    expect(splitPenalty(1000)).toEqual({
      totalCents: 1000,
      burnCents: 200,
      purgatoryCents: 800,
    });
  });

  it('conserves every cent — burn + purgatory always equals the total', () => {
    // Rounding must never mint or destroy money, at any amount.
    for (let total = 0; total <= 500; total++) {
      const { burnCents, purgatoryCents } = splitPenalty(total);
      expect(burnCents + purgatoryCents).toBe(total);
      expect(Number.isInteger(burnCents)).toBe(true);
      expect(Number.isInteger(purgatoryCents)).toBe(true);
      expect(burnCents).toBeGreaterThanOrEqual(0);
      expect(purgatoryCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles a zero penalty without producing -0 or NaN', () => {
    const split = splitPenalty(0);
    expect(split).toEqual({ totalCents: 0, burnCents: 0, purgatoryCents: 0 });
  });

  it('rounds the burn rather than truncating it', () => {
    // 3 cents × 0.2 = 0.6 → rounds to 1, leaving 2 in purgatory.
    expect(splitPenalty(3)).toEqual({ totalCents: 3, burnCents: 1, purgatoryCents: 2 });
  });
});

describe('sessionPenaltyCents', () => {
  it('charges the stated rate for a normal session', () => {
    // 10 minutes at €0.50/min = €5.00, well under a €30 cap.
    expect(sessionPenaltyCents(600, 50, 3000)).toEqual({
      penaltyCents: 500,
      capReached: false,
    });
  });

  it('clamps to the cap and flags it once the raw amount reaches it', () => {
    const result = sessionPenaltyCents(60 * 60 * 5, 100, 3000); // 5h at €1/min
    expect(result.penaltyCents).toBe(3000);
    expect(result.capReached).toBe(true);
  });

  it('treats exactly hitting the cap as capReached', () => {
    // 30 minutes at €1.00/min = €30.00 == the cap exactly.
    expect(sessionPenaltyCents(1800, 100, 3000)).toEqual({
      penaltyCents: 3000,
      capReached: true,
    });
  });

  it('charges nothing for a zero-duration session', () => {
    expect(sessionPenaltyCents(0, 100, 3000)).toEqual({
      penaltyCents: 0,
      capReached: false,
    });
  });

  it('never exceeds the cap across a wide sweep of durations', () => {
    const cap = 2500;
    for (let seconds = 0; seconds <= 60 * 60 * 3; seconds += 137) {
      const { penaltyCents } = sessionPenaltyCents(seconds, 75, cap);
      expect(penaltyCents).toBeLessThanOrEqual(cap);
      expect(Number.isInteger(penaltyCents)).toBe(true);
    }
  });

  it('bills sub-minute usage proportionally, in whole cents', () => {
    // 30s at €1.00/min = 50 cents.
    expect(sessionPenaltyCents(30, 100, 3000).penaltyCents).toBe(50);
    // 1s at €1.00/min = 1.67 → 2 cents.
    expect(sessionPenaltyCents(1, 100, 3000).penaltyCents).toBe(2);
  });

  it('is monotonic — more scrolling never costs less', () => {
    let previous = 0;
    for (let seconds = 0; seconds <= 4000; seconds += 60) {
      const { penaltyCents } = sessionPenaltyCents(seconds, 40, 100_000);
      expect(penaltyCents).toBeGreaterThanOrEqual(previous);
      previous = penaltyCents;
    }
  });

  it('a zero cap charges nothing but reports the cap as reached', () => {
    expect(sessionPenaltyCents(600, 50, 0)).toEqual({
      penaltyCents: 0,
      capReached: true,
    });
  });
});

describe('requiredWalkingMinutes', () => {
  it('owes 2 walking minutes per scrolled minute', () => {
    expect(requiredWalkingMinutes(600)).toBe(20);
  });

  it('rounds partial minutes UP — the debt is never rounded in the user\'s favour', () => {
    expect(requiredWalkingMinutes(30)).toBe(1); // 0.5 min scrolled → 1 min owed
    expect(requiredWalkingMinutes(1)).toBe(1);
  });

  it('owes nothing for a zero-duration session', () => {
    expect(requiredWalkingMinutes(0)).toBe(0);
  });

  it('always returns a whole number of minutes', () => {
    for (let seconds = 0; seconds < 3600; seconds += 7) {
      expect(Number.isInteger(requiredWalkingMinutes(seconds))).toBe(true);
    }
  });
});

describe('anchorPercent', () => {
  it('reports the penalty as a percentage of the anchor, to one decimal', () => {
    expect(anchorPercent(600, 25_000)).toBe(2.4); // €6 of €250 AirPods
    expect(anchorPercent(12_500, 25_000)).toBe(50);
  });

  it('returns 0 for a non-positive anchor price instead of dividing by zero', () => {
    expect(anchorPercent(500, 0)).toBe(0);
    expect(anchorPercent(500, -100)).toBe(0);
  });

  it('can exceed 100% once the anchor is fully burned', () => {
    expect(anchorPercent(50_000, 25_000)).toBe(200);
  });
});

describe('newlyCrossedTiers', () => {
  const anchors = [
    { tierLevel: 1, priceCents: 500 },
    { tierLevel: 2, priceCents: 2500 },
    { tierLevel: 3, priceCents: 8000 },
  ];

  it('returns nothing when the meter has not reached the first anchor', () => {
    expect(newlyCrossedTiers(499, 0, anchors)).toEqual([]);
  });

  it('returns a tier the moment its price is exactly covered', () => {
    expect(newlyCrossedTiers(500, 0, anchors)).toEqual([{ tierLevel: 1, priceCents: 500 }]);
  });

  it('never re-fires a tier that has already taunted', () => {
    expect(newlyCrossedTiers(3000, 2, anchors)).toEqual([]);
  });

  it('returns multiple tiers in ascending order when several are crossed at once', () => {
    expect(newlyCrossedTiers(9000, 0, anchors)).toEqual([
      { tierLevel: 1, priceCents: 500 },
      { tierLevel: 2, priceCents: 2500 },
      { tierLevel: 3, priceCents: 8000 },
    ]);
  });

  it('sorts ascending even when the anchors arrive out of order', () => {
    const shuffled = [anchors[2], anchors[0], anchors[1]];
    expect(newlyCrossedTiers(9000, 0, shuffled).map((a) => a.tierLevel)).toEqual([1, 2, 3]);
  });

  it('handles a user with no anchors at all (the pure-taunt path)', () => {
    expect(newlyCrossedTiers(50_000, 0, [])).toEqual([]);
  });
});

describe('isHeartbeatBreached', () => {
  const now = new Date('2026-01-10T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  it('is never breached before the device has ever pinged', () => {
    // No baseline: a user who never armed must not be charged a deletion fee.
    expect(isHeartbeatBreached(null, now)).toBe(false);
  });

  it('is not breached within the 24h window', () => {
    expect(isHeartbeatBreached(hoursAgo(1), now)).toBe(false);
    expect(isHeartbeatBreached(hoursAgo(23), now)).toBe(false);
  });

  it('is not breached at exactly the threshold — only strictly beyond it', () => {
    expect(isHeartbeatBreached(hoursAgo(BREACH_AFTER_HOURS), now)).toBe(false);
  });

  it('is breached after two missed 12h pings', () => {
    expect(isHeartbeatBreached(hoursAgo(BREACH_AFTER_HOURS + 0.01), now)).toBe(true);
    expect(isHeartbeatBreached(hoursAgo(72), now)).toBe(true);
  });

  it('is not breached when the clock skews and the last ping is in the future', () => {
    expect(isHeartbeatBreached(new Date(now.getTime() + 3600_000), now)).toBe(false);
  });
});

describe('isHeartbeatWarning', () => {
  const now = new Date('2026-01-10T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  it('does not warn a device that has never pinged', () => {
    expect(isHeartbeatWarning(null, now)).toBe(false);
  });

  it('does not warn before the 18h mark', () => {
    expect(isHeartbeatWarning(hoursAgo(17.9), now)).toBe(false);
  });

  it('warns from 18h up to the breach threshold', () => {
    expect(isHeartbeatWarning(hoursAgo(HEARTBEAT_WARNING_AFTER_HOURS), now)).toBe(true);
    expect(isHeartbeatWarning(hoursAgo(20), now)).toBe(true);
    expect(isHeartbeatWarning(hoursAgo(BREACH_AFTER_HOURS), now)).toBe(true);
  });

  it('stops warning once breached — past 24h it is the breach path, not a warning', () => {
    expect(isHeartbeatWarning(hoursAgo(BREACH_AFTER_HOURS + 1), now)).toBe(false);
  });

  it('never overlaps with isHeartbeatBreached', () => {
    // The two states must be mutually exclusive at every hour, or a user could
    // be warned and charged in the same sweep.
    for (let h = 0; h <= 48; h += 0.5) {
      const last = hoursAgo(h);
      expect(isHeartbeatWarning(last, now) && isHeartbeatBreached(last, now)).toBe(false);
    }
  });
});

describe('isGraceExpired', () => {
  const pending = new Date('2026-01-10T00:00:00Z');
  const plus = (h: number) => new Date(pending.getTime() + h * 3600_000);

  it('is not expired immediately', () => {
    expect(isGraceExpired(pending, pending)).toBe(false);
  });

  it('is not expired part-way through the window', () => {
    expect(isGraceExpired(pending, plus(BREACH_GRACE_HOURS - 0.1))).toBe(false);
  });

  it('is expired at exactly the window and beyond', () => {
    expect(isGraceExpired(pending, plus(BREACH_GRACE_HOURS))).toBe(true);
    expect(isGraceExpired(pending, plus(100))).toBe(true);
  });
});

describe('isBreachCured', () => {
  const pending = new Date('2026-01-10T00:00:00Z');

  it('is not cured with no heartbeat at all', () => {
    expect(isBreachCured(null, pending)).toBe(false);
  });

  it('is not cured by the stale ping that caused the breach', () => {
    expect(isBreachCured(new Date(pending.getTime() - 3600_000), pending)).toBe(false);
  });

  it('is not cured by a ping exactly at the pending marker', () => {
    expect(isBreachCured(pending, pending)).toBe(false);
  });

  it('is cured by any ping after the marker — the app came back', () => {
    expect(isBreachCured(new Date(pending.getTime() + 1), pending)).toBe(true);
    expect(isBreachCured(new Date(pending.getTime() + 6 * 3600_000), pending)).toBe(true);
  });
});

describe('grace rail timing as a whole', () => {
  it('gives the user strictly more time than the bare threshold', () => {
    // The whole point: nobody is charged at the 24h mark any more.
    expect(BREACH_GRACE_HOURS).toBeGreaterThan(0);
    expect(HEARTBEAT_WARNING_AFTER_HOURS).toBeLessThan(BREACH_AFTER_HOURS);
  });

  it('warns before the switch fires, leaving time to act', () => {
    const warnHoursBeforeCharge =
      BREACH_AFTER_HOURS + BREACH_GRACE_HOURS - HEARTBEAT_WARNING_AFTER_HOURS;
    expect(warnHoursBeforeCharge).toBeGreaterThanOrEqual(12);
  });
});

describe('splitDailyFree', () => {
  const FIVE_MIN = 300;

  it('bills everything when the allowance is zero', () => {
    expect(splitDailyFree(0, 30, 0)).toEqual({ freeSeconds: 0, billableSeconds: 30 });
  });

  it('charges nothing while the day is still inside the allowance', () => {
    expect(splitDailyFree(0, 30, FIVE_MIN)).toEqual({ freeSeconds: 30, billableSeconds: 0 });
  });

  it('splits a burst that straddles the end of the allowance', () => {
    expect(splitDailyFree(280, 30, FIVE_MIN)).toEqual({ freeSeconds: 20, billableSeconds: 10 });
  });

  it('bills everything once the day has spent its allowance', () => {
    expect(splitDailyFree(600, 30, FIVE_MIN)).toEqual({ freeSeconds: 0, billableSeconds: 30 });
  });

  it('treats the boundary itself as still free', () => {
    expect(splitDailyFree(270, 30, FIVE_MIN)).toEqual({ freeSeconds: 30, billableSeconds: 0 });
  });

  it('is a no-op for a zero delta', () => {
    expect(splitDailyFree(100, 0, FIVE_MIN)).toEqual({ freeSeconds: 0, billableSeconds: 0 });
  });

  // The invariant that matters: heartbeats arrive at arbitrary cadences, and a
  // day chopped into 1s pieces must free and bill exactly the same totals as
  // one chopped into 2-minute pieces. Anything else means the free allowance
  // depends on network timing, which the user would experience as the meter
  // charging inconsistently for identical behaviour.
  it('frees and bills the same totals however the day is chunked', () => {
    const chunkings = [[30], [1, 1, 1], [120, 120, 120, 120], [7, 13, 299, 41, 88]];
    for (const chunks of chunkings) {
      for (const allowance of [0, 60, FIVE_MIN, 3600]) {
        let before = 0;
        let free = 0;
        let billable = 0;
        for (const delta of chunks) {
          const split = splitDailyFree(before, delta, allowance);
          free += split.freeSeconds;
          billable += split.billableSeconds;
          before += delta;
        }
        const total = chunks.reduce((a, b) => a + b, 0);
        expect(free + billable).toBe(total); // no seconds invented or lost
        expect(free).toBe(Math.min(total, allowance)); // exactly the allowance, no more
      }
    }
  });

  // Two heartbeats can land at once. The caller derives `before` from a single
  // atomic increment, so each gets a disjoint range — if this ever double-spent,
  // a user would get free time they hadn't earned and the meter would under-bill.
  it('cannot grant the same free second twice to racing heartbeats', () => {
    const a = splitDailyFree(290, 20, FIVE_MIN); // increment returned 310
    const b = splitDailyFree(310, 20, FIVE_MIN); // increment returned 330
    expect(a.freeSeconds + b.freeSeconds).toBe(10); // only the 10s that remained
  });

  it('never returns negative or fractional seconds', () => {
    for (let before = 0; before < 700; before += 13) {
      for (const delta of [0, 1, 30, 120]) {
        const split = splitDailyFree(before, delta, FIVE_MIN);
        expect(split.freeSeconds).toBeGreaterThanOrEqual(0);
        expect(split.billableSeconds).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(split.freeSeconds)).toBe(true);
        expect(Number.isInteger(split.billableSeconds)).toBe(true);
      }
    }
  });
});

describe('freeSecondsRemaining', () => {
  it('reports the untouched allowance', () => {
    expect(freeSecondsRemaining(0, 5)).toBe(300);
  });

  it('counts down as the day is spent', () => {
    expect(freeSecondsRemaining(120, 5)).toBe(180);
  });

  it('floors at zero rather than going negative', () => {
    expect(freeSecondsRemaining(9999, 5)).toBe(0);
  });

  it('is always zero when the user chose no allowance', () => {
    expect(freeSecondsRemaining(0, 0)).toBe(0);
    expect(freeSecondsRemaining(50, 0)).toBe(0);
  });
});

describe('constants', () => {
  it('holds the settled product decisions', () => {
    // These are product decisions, not tunables — a change here is a business
    // decision and should break this test on purpose.
    expect(BURN_SHARE).toBe(0.2);
    expect(SWEAT_RATIO).toBe(2);
    expect(REDEMPTION_WINDOW_HOURS).toBe(24);
    expect(BREACH_AFTER_HOURS).toBe(24);
    expect(MAX_DELETION_FEE_CENTS).toBe(100_000);
    expect(ANCHOR_TIER_COUNT).toBe(5);
    // A ceiling, not a recommendation — but it must exist, or the allowance
    // could be set high enough to switch the meter off permanently.
    expect(MAX_DAILY_FREE_MINUTES).toBe(120);
  });
});

describe('the weekly cap', () => {
  it('leaves the whole cap spendable on a fresh week', () => {
    expect(weeklyHeadroomCents(0, 1000)).toBe(1000);
  });

  it('shrinks as the week is spent, and never goes negative', () => {
    expect(weeklyHeadroomCents(400, 1000)).toBe(600);
    expect(weeklyHeadroomCents(1000, 1000)).toBe(0);
    // A week can overshoot if a hold was captured late; headroom floors at 0
    // rather than handing back a negative that would read as credit.
    expect(weeklyHeadroomCents(1500, 1000)).toBe(0);
  });

  it('charges the full penalty while the week has room', () => {
    expect(applyWeeklyCap(300, 0, 1000)).toEqual({
      chargeableCents: 300,
      capReached: false,
    });
  });

  it('clamps the charge that would cross the cap, and reports it', () => {
    // Owed 400, only 250 of the week is left: bill 250 and lock, never 400.
    expect(applyWeeklyCap(400, 750, 1000)).toEqual({
      chargeableCents: 250,
      capReached: true,
    });
  });

  it('charges nothing once the cap is spent', () => {
    expect(applyWeeklyCap(400, 1000, 1000)).toEqual({
      chargeableCents: 0,
      capReached: true,
    });
  });

  it('treats an exactly-fitting penalty as reaching the cap', () => {
    // Spending the last cent still locks the week — the next session must not
    // open a billable meter with zero headroom behind it.
    expect(applyWeeklyCap(250, 750, 1000)).toEqual({
      chargeableCents: 250,
      capReached: true,
    });
  });

  it('never bills a negative penalty', () => {
    expect(applyWeeklyCap(-50, 0, 1000).chargeableCents).toBe(0);
  });

  it('holds the settled bounds', () => {
    expect(DEFAULT_WEEKLY_CAP_CENTS).toBe(1000);
    expect(MIN_WEEKLY_CAP_CENTS).toBeLessThan(DEFAULT_WEEKLY_CAP_CENTS);
    expect(MAX_WEEKLY_CAP_CENTS).toBeGreaterThan(DEFAULT_WEEKLY_CAP_CENTS);
  });
});
