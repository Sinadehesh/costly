'use client';

import { useMemo } from 'react';

/**
 * THE MASCOT. A stupid little black cat that PEEKS over the edge of a bright
 * widget card — silhouette body, big dumb white eyes, paws gripping the ledge,
 * whiskers spilling out onto the card. It reacts to how much you've fed it.
 *
 * Snack tiers (driven by penaltyCents):
 *   Tier 1  < €1   — smug, half-closed eyes.       "More please."
 *   Tier 2  < €10  — confused, mismatched eyes.    "Yum."
 *   Tier 3  ≥ €10  — unhinged, yelling.            "That's so much money."
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
  3: { mood: 'unhinged', line: "That's so much money.", card: 'bg-red-500' },
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

const FUR = '#0a0a0a';

/** The flat 2D peeking black cat. Three faces, zero dignity. */
function CatFace({ mood }: { mood: CatMood }) {
  return (
    <svg viewBox="0 0 100 82" className="h-24 w-24 shrink-0" aria-hidden="true">
      {/* whiskers — drawn first so they sit behind the head and spill onto the card */}
      <g stroke={FUR} strokeWidth="2" strokeLinecap="round">
        <line x1="7" y1="47" x2="34" y2="50" />
        <line x1="7" y1="56" x2="34" y2="55" />
        <line x1="93" y1="47" x2="66" y2="50" />
        <line x1="93" y1="56" x2="66" y2="55" />
      </g>

      {/* pointy ears */}
      <polygon points="26,24 33,3 49,18" fill={FUR} />
      <polygon points="74,24 67,3 51,18" fill={FUR} />

      {/* head — rounded dome, flat bottom, as if peeking over a ledge */}
      <path d="M14,66 V46 a36,33 0 0 1 72,0 V66 Z" fill={FUR} />

      {/* two paws gripping the ledge (three toes each) */}
      <g fill={FUR}>
        <rect x="27" y="60" width="6" height="18" rx="3" />
        <rect x="34" y="60" width="6" height="18" rx="3" />
        <rect x="41" y="60" width="6" height="18" rx="3" />
        <rect x="53" y="60" width="6" height="18" rx="3" />
        <rect x="60" y="60" width="6" height="18" rx="3" />
        <rect x="67" y="60" width="6" height="18" rx="3" />
      </g>

      {mood === 'smug' && (
        <g>
          {/* half-closed content eyes (upward arcs) */}
          <path d="M31 47 q7 -8 14 0" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <path d="M55 47 q7 -8 14 0" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          {/* tiny smug smile */}
          <path d="M44 56 q6 5 12 0" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}

      {mood === 'confused' && (
        <g>
          {/* big mismatched dumb eyes */}
          <circle cx="38" cy="45" r="8.5" fill="#fff" />
          <circle cx="62" cy="44" r="10" fill="#fff" />
          <circle cx="39" cy="47" r="3.5" fill={FUR} />
          <circle cx="60" cy="46" r="4" fill={FUR} />
          {/* tiny nose */}
          <path d="M46 55 h8 l-4 4 Z" fill="#fff" />
        </g>
      )}

      {mood === 'unhinged' && (
        <g>
          {/* narrowed, angled, furious eyes */}
          <polygon points="30,41 47,48 46,53 30,47" fill="#fff" />
          <polygon points="70,41 53,48 54,53 70,47" fill="#fff" />
          <circle cx="39" cy="47" r="2.6" fill={FUR} />
          <circle cx="61" cy="47" r="2.6" fill={FUR} />
          {/* yelling mouth */}
          <ellipse cx="50" cy="59" rx="6.5" ry="5" fill="#fff" />
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
