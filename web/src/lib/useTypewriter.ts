'use client';

import { useEffect, useState } from 'react';

/**
 * Villain messages type themselves out — it's in the product spec, and it does
 * real work: a line that appears instantly is read as UI copy, while a line
 * that types is read as something ADDRESSING you. That's the whole persona.
 *
 * Two rules it has to obey:
 *   - Reduced motion gets the finished string immediately. Somebody who asked
 *     the OS to stop animations should not have to wait for a joke to finish.
 *   - The full text is always in the DOM for assistive tech (see CatWidget's
 *     sr-only copy) — nobody should hear a sentence delivered one letter at a
 *     time.
 */
export function useTypewriter(text: string, charMs = 18): string {
  const [shown, setShown] = useState('');

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      setShown(text);
      return;
    }

    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, charMs);
    return () => clearInterval(id);
  }, [text, charMs]);

  return shown;
}
