'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Money that moves like a mechanical counter. The spec asks for odometer
 * digits, and the reason is behavioural, not decorative: a number that ROLLS
 * is felt as something being taken, while a number that simply re-renders is
 * read as a data point. This product needs the first one.
 *
 * Only the digits that actually changed animate. Rolling the whole figure on
 * every update makes small changes look enormous and big ones look routine —
 * exactly backwards.
 */
export function Odometer({ value, className = '' }: { value: string; className?: string }) {
  const previous = useRef(value);
  const [chars, setChars] = useState<{ ch: string; changed: boolean }[]>(() =>
    [...value].map((ch) => ({ ch, changed: false })),
  );

  useEffect(() => {
    const before = previous.current;
    setChars(
      [...value].map((ch, i) => ({
        // Compare from the right: currency figures grow leftwards, so
        // index-from-left comparison marks every digit as changed the moment
        // the number gains a place.
        ch,
        changed: ch !== before[before.length - value.length + i],
      })),
    );
    previous.current = value;
  }, [value]);

  return (
    <span className={`money ${className}`} aria-label={value}>
      {chars.map((c, i) => (
        <span
          key={`${i}-${c.ch}`}
          aria-hidden="true"
          className={c.changed && /\d/.test(c.ch) ? 'digit-roll' : undefined}
        >
          {c.ch}
        </span>
      ))}
    </span>
  );
}
