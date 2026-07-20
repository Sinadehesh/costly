'use client';

import { useMemo } from 'react';

/**
 * THE MASCOT. An incredibly stupid, flat-vector orange cat that lives in
 * bright widget cards floating over the dark terminal UI.
 *
 * Snack tiers (driven by penaltyCents):
 *   Tier 1  < €1   — smug.      "More please."
 *   Tier 2  < €10  — confused, chewing on a coin. "Yum."
 *   Tier 3  ≥ €10  — unhinged, yelling. "That's so much honey."
 * (The spec names <€5 and €10+; the €5–10 gap collapses into tier 2 so the
 * cat always has an opinion.)
 *
 * Taunts: if the user named wishlist products, the cat attacks those
 * ("I took your PlayStation money!"). If not, it falls back to pure taunts
 * about what it spent the money on. Blank wishlist is a fully supported
 * state, not an error.
 */

type CatMood = 'smug' | 'confused' | 'unhinged';

export function snackTier(penaltyCents: number): 1 | 2 | 3 {
  if (penaltyCents < 100) return 1;
  if (penaltyCents < 1000) return 2;
  return 3;
}

const TIER_CONTENT: Record<1 | 2 | 3, { mood: CatMood; line: string; card: string }> = {
  1: { mood: 'smug', line: 'More please.', card: 'bg-amber-400' },
  2: { mood: 'confused', line: 'Yum.', card: 'bg-orange-400' },
  3: { mood: 'unhinged', line: "That's so much honey.", card: 'bg-red-500' },
};

const PURE_TAUNTS = [
  'Spent it on dirty socks and a dead pigeon. No refunds.',
  'I bought a rock with your money. The rock is my friend now.',
  'Your money is gone. I ate the receipt.',
  'I put it all in a hole. Great hole. You paid for it.',
  'Bought seventeen identical spoons. Needed none of them.',
];

/** Deterministic pick so the taunt doesn't reshuffle on every render. */
function pureTaunt(seed: number): string {
  return PURE_TAUNTS[Math.abs(seed) % PURE_TAUNTS.length];
}

export function tauntLine(penaltyCents: number, wishlistItem?: string | null): string {
  if (penaltyCents <= 0) return 'Nothing yet. I am patient. And hungry.';
  if (wishlistItem) return `I took your ${wishlistItem} money!`;
  return pureTaunt(Math.floor(penaltyCents / 100));
}

/** The flat 2D vector cat. Three faces, zero dignity. */
function CatFace({ mood }: { mood: CatMood }) {
  return (
    <svg viewBox="0 0 96 96" className="h-20 w-20 shrink-0" aria-hidden="true">
      {/* ears */}
      <polygon points="18,34 26,8 42,26" fill="#f97316" stroke="#431407" strokeWidth="3" />
      <polygon points="78,34 70,8 54,26" fill="#f97316" stroke="#431407" strokeWidth="3" />
      <polygon points="23,29 27,15 36,25" fill="#fdba74" />
      <polygon points="73,29 69,15 60,25" fill="#fdba74" />
      {/* head */}
      <circle cx="48" cy="52" r="34" fill="#f97316" stroke="#431407" strokeWidth="3" />
      {/* belly patch */}
      <ellipse cx="48" cy="66" rx="16" ry="12" fill="#fdba74" />
      {/* whiskers */}
      <g stroke="#431407" strokeWidth="2" strokeLinecap="round">
        <line x1="10" y1="50" x2="24" y2="52" />
        <line x1="10" y1="58" x2="24" y2="57" />
        <line x1="86" y1="50" x2="72" y2="52" />
        <line x1="86" y1="58" x2="72" y2="57" />
      </g>

      {mood === 'smug' && (
        <g>
          {/* half-closed judging eyes */}
          <path d="M32 46 q6 6 12 0" fill="none" stroke="#431407" strokeWidth="3" strokeLinecap="round" />
          <path d="M52 46 q6 6 12 0" fill="none" stroke="#431407" strokeWidth="3" strokeLinecap="round" />
          {/* tiny self-satisfied smile */}
          <path d="M42 62 q6 5 12 0" fill="none" stroke="#431407" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {mood === 'confused' && (
        <g>
          {/* wide mismatched eyes */}
          <circle cx="38" cy="46" r="6" fill="#fff" stroke="#431407" strokeWidth="2.5" />
          <circle cx="58" cy="45" r="8" fill="#fff" stroke="#431407" strokeWidth="2.5" />
          <circle cx="39" cy="47" r="2.5" fill="#431407" />
          <circle cx="56" cy="46" r="3" fill="#431407" />
          {/* coin sticking out of mouth */}
          <ellipse cx="48" cy="66" rx="9" ry="8" fill="#facc15" stroke="#431407" strokeWidth="2.5" />
          <text x="48" y="70" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#431407">
            €
          </text>
        </g>
      )}

      {mood === 'unhinged' && (
        <g>
          {/* spiral-adjacent crazed eyes */}
          <circle cx="37" cy="45" r="8" fill="#fff" stroke="#431407" strokeWidth="2.5" />
          <circle cx="59" cy="45" r="8" fill="#fff" stroke="#431407" strokeWidth="2.5" />
          <circle cx="35" cy="43" r="3" fill="#431407" />
          <circle cx="62" cy="47" r="3" fill="#431407" />
          {/* yelling mouth */}
          <ellipse cx="48" cy="66" rx="10" ry="9" fill="#431407" />
          <ellipse cx="48" cy="69" rx="5" ry="3.5" fill="#ef4444" />
          {/* motion marks — pure geometry, no animation */}
          <g stroke="#431407" strokeWidth="2.5" strokeLinecap="round">
            <line x1="14" y1="22" x2="20" y2="28" />
            <line x1="82" y1="22" x2="76" y2="28" />
            <line x1="48" y1="6" x2="48" y2="13" />
          </g>
        </g>
      )}
    </svg>
  );
}

export function CatWidget({
  penaltyCents,
  wishlistItem,
  className = '',
}: {
  penaltyCents: number;
  /** Name of a wishlist product to attack; null/undefined = pure-taunt mode. */
  wishlistItem?: string | null;
  className?: string;
}) {
  const tier = snackTier(penaltyCents);
  const { mood, line, card } = TIER_CONTENT[tier];
  const taunt = useMemo(() => tauntLine(penaltyCents, wishlistItem), [penaltyCents, wishlistItem]);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border-4 border-zinc-900 p-3 shadow-[6px_6px_0_0_rgba(0,0,0,0.6)] ${card} ${className}`}
    >
      <CatFace mood={mood} />
      <div className="min-w-0">
        <p className="text-lg font-extrabold leading-tight text-zinc-950">{line}</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-zinc-900/80">{taunt}</p>
      </div>
    </div>
  );
}
