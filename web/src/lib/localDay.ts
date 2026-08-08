/**
 * User-local calendar days, without ever converting a wall-clock time in an
 * arbitrary timezone back to a UTC instant — that direction is the
 * DST-fragile one. We only ask Intl what the local date/hour IS right now
 * (Intl applies the correct offset, DST included) and work from there.
 *
 * Convention, shared with DailyActivity.day and DailyMeter.day: a local
 * calendar day is stored as the UTC-midnight Date of that Y/M/D. It is a
 * date label, not an instant — never subtract it from a real timestamp.
 */

export interface LocalNowParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
}

/**
 * The user's current local date and hour. Falls back to UTC on an invalid
 * timezone: tz strings are validated at ingestion, but this runs on the
 * charging path, where trusting stored data would be the wrong instinct.
 */
export function localNowParts(now: Date, timeZone: string): LocalNowParts {
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);

  const parts = (() => {
    try {
      return format(timeZone);
    } catch {
      return format('UTC');
    }
  })();

  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

/** The user's local calendar day right now, as a UTC-midnight Date. */
export function localCalendarDay(now: Date, timeZone: string): Date {
  const { year, month, day } = localNowParts(now, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * The Monday that starts the user's current local week, as a UTC-midnight
 * Date — the window the weekly cap is measured over.
 *
 * Built from the day label rather than from the raw instant, so a user in a
 * timezone where it is already Monday gets the new week's allowance and one
 * where it is still Sunday does not. Monday because a cap that resets on
 * Sunday night is a cap that resets mid-weekend, which is when it matters.
 */
export function localWeekStart(now: Date, timeZone: string): Date {
  const day = localCalendarDay(now, timeZone);
  // getUTCDay(): 0=Sunday … 6=Saturday. Monday-based offset: Sunday is 6 back.
  const offset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offset * 86_400_000);
}
