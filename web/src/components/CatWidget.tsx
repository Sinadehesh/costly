'use client';

import { useMemo } from 'react';
import { CatFace, TONE_BG } from '@/components/Cat';
import { type CatContext, catLine, catSkin } from '@/lib/cat';
import { useTypewriter } from '@/lib/useTypewriter';

// Re-exported so existing call sites and tests keep working.
export { snackTier, tauntLine } from '@/lib/cat';

/**
 * THE MASCOT CARD. The cat peeks over a bright ledge and says one thing.
 *
 * It used to know exactly one fact about the world — how much money it had
 * eaten — which meant it had no face for the states that matter most: nothing
 * armed, the user walking their debt back, the user WINNING. The spec is
 * explicit that the villain can lose and that winning must feel as designed as
 * losing, so the mood now comes from context (see lib/cat.ts) and the money is
 * only the last tiebreaker.
 */
export function CatWidget({
  penaltyCents,
  wishlistItem,
  armed,
  walkingPct,
  kindMode,
  className = '',
}: CatContext & {
  /** Name of a wishlist product to attack; null/undefined = pure-taunt mode. */
  wishlistItem?: string | null;
  className?: string;
}) {
  const ctx = useMemo<CatContext>(
    () => ({ penaltyCents, armed, walkingPct, kindMode }),
    [penaltyCents, armed, walkingPct, kindMode],
  );
  const skin = useMemo(() => catSkin(ctx), [ctx]);
  const line = useMemo(
    () => catLine(ctx, skin.taunts ? wishlistItem : null),
    [ctx, skin.taunts, wishlistItem],
  );
  const typed = useTypewriter(line);

  const won = skin.mood === 'defeated';

  return (
    <div
      className={`relative flex items-center gap-3 rounded-[var(--radius-card)] border-4 border-bg/70 p-3 shadow-[6px_6px_0_0_rgba(0,0,0,0.55)] ${
        won ? 'ring-2 ring-gold ring-offset-2 ring-offset-bg' : ''
      } ${className}`}
      style={{ backgroundColor: TONE_BG[skin.tone] }}
    >
      <CatFace mood={skin.mood} behaviour={skin.behaviour} />

      <div className="min-w-0">
        <p className="text-lg leading-tight font-extrabold text-bg">{skin.line}</p>

        {/* The typed line is decorative motion; screen readers get the whole
            sentence at once rather than a letter at a time. */}
        <p aria-hidden="true" className="mt-1 text-sm leading-snug font-semibold text-bg/80">
          {typed}
          {typed.length < line.length && <span className="caret" />}
        </p>
        <p className="sr-only">{line}</p>
      </div>
    </div>
  );
}
