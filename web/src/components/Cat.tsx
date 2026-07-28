'use client';

import type { CatMood } from '@/lib/cat';

/**
 * THE MASCOT. A stupid little black cat that peeks over the edge of a card —
 * silhouette body, big dumb eyes, paws gripping the ledge, whiskers spilling
 * out. Nine faces now, not three, and it moves when nothing is happening.
 *
 * Why idle motion at all: a mascot that holds perfectly still reads as a
 * sticker, and this one is supposed to feel like it is WATCHING you. Blinks,
 * ear twitches and a flicking tail are deliberately small — alive in
 * peripheral vision, never competing with the number that costs money.
 * All of it collapses under prefers-reduced-motion (see globals.css).
 *
 * The cat is drawn as a black silhouette, so every card tone below is a LIGHT
 * colour. That is a hard constraint, not a palette preference: put this cat on
 * the app's near-black surface and it disappears.
 */

const FUR = '#0a0a0a';
const EYE = '#ffffff';

/** Card tones. Gold is fenced off for the user beating the house. */
export const TONE_BG: Record<string, string> = {
  slate: '#79836f',
  calm: '#a9c3cf', // self-exclusion: cool, quiet, unmistakably not a taunt
  amber: '#d9a441',
  orange: '#e87f3c',
  red: '#ef4444',
  gold: '#f5b940',
};

function Ears({ flat }: { flat: boolean }) {
  // Flattened ears are the single clearest "this animal is unhappy" signal in
  // the whole drawing — worth more than any eye shape for sulking/defeat.
  //
  // Drawn as different polygons rather than by rotating the upright pair:
  // rotating swept them fully behind the head dome (x 14..86) and the cat came
  // out bald. These are pinned low and wide, so the tips clear the skull on
  // either side and read as ears held flat against it.
  if (flat) {
    return (
      <>
        <polygon points="2,47 32,25 28,46" fill={FUR} />
        <polygon points="98,47 68,25 72,46" fill={FUR} />
      </>
    );
  }
  return (
    <>
      <polygon points="26,24 33,3 49,18" fill={FUR} className="cat-part cat-twitch" />
      <polygon points="74,24 67,3 51,18" fill={FUR} className="cat-part cat-twitch" />
    </>
  );
}

function Eyes({ mood }: { mood: CatMood }) {
  const blink = <g className="cat-part cat-blink" />;

  switch (mood) {
    case 'asleep':
      // Closed, curving downward — the universal shorthand for sleeping.
      return (
        <g stroke={EYE} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M31 46 q7 7 14 0" />
          <path d="M55 46 q7 7 14 0" />
        </g>
      );

    case 'kind':
      // Soft, open, symmetrical. No angles anywhere — this face must not be
      // readable as sarcasm, because on this path sarcasm is forbidden.
      return (
        <g className="cat-part cat-blink">
          <circle cx="39" cy="46" r="7" fill={EYE} />
          <circle cx="61" cy="46" r="7" fill={EYE} />
          <circle cx="39" cy="47" r="3" fill={FUR} />
          <circle cx="61" cy="47" r="3" fill={FUR} />
        </g>
      );

    case 'waiting':
      // Wide, alert, pupils dead centre: watching you, waiting for a mistake.
      return (
        <g className="cat-part cat-blink">
          <circle cx="39" cy="46" r="9" fill={EYE} />
          <circle cx="61" cy="46" r="9" fill={EYE} />
          <ellipse cx="39" cy="46" rx="2.4" ry="6" fill={FUR} />
          <ellipse cx="61" cy="46" rx="2.4" ry="6" fill={FUR} />
        </g>
      );

    case 'smug':
      return (
        <g stroke={EYE} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M31 47 q7 -8 14 0" />
          <path d="M55 47 q7 -8 14 0" />
        </g>
      );

    case 'greedy':
      // Money eyes. The one moment the cat stops pretending to be a pet.
      return (
        <g className="cat-part cat-blink">
          <circle cx="38" cy="45" r="9.5" fill={EYE} />
          <circle cx="62" cy="45" r="9.5" fill={EYE} />
          <text
            x="38"
            y="50"
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill={FUR}
            fontFamily="ui-monospace, monospace"
          >
            €
          </text>
          <text
            x="62"
            y="50"
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill={FUR}
            fontFamily="ui-monospace, monospace"
          >
            €
          </text>
        </g>
      );

    case 'unhinged':
      return (
        <g>
          <polygon points="30,41 47,48 46,53 30,47" fill={EYE} />
          <polygon points="70,41 53,48 54,53 70,47" fill={EYE} />
          <circle cx="39" cy="47" r="2.6" fill={FUR} />
          <circle cx="61" cy="47" r="2.6" fill={FUR} />
        </g>
      );

    case 'stuffed':
      // Spiral eyes: overfed to the point of system failure.
      return (
        <g stroke={EYE} strokeWidth="2.6" fill="none" strokeLinecap="round">
          <path d="M39 46 m0,-6 a6,6 0 1,1 -4,10 a4,4 0 1,1 6,-6 a2,2 0 1,1 -2,3" />
          <path d="M61 46 m0,-6 a6,6 0 1,1 -4,10 a4,4 0 1,1 6,-6 a2,2 0 1,1 -2,3" />
        </g>
      );

    case 'sulking':
      // Side-eye: pupils dragged away from you, lids low. It knows it's losing.
      return (
        <g className="cat-part cat-blink">
          <ellipse cx="39" cy="47" rx="8" ry="5.5" fill={EYE} />
          <ellipse cx="61" cy="47" rx="8" ry="5.5" fill={EYE} />
          <circle cx="34" cy="48" r="3.2" fill={FUR} />
          <circle cx="56" cy="48" r="3.2" fill={FUR} />
          <path d="M30 41 L48 45" stroke={FUR} strokeWidth="4" strokeLinecap="round" />
          <path d="M70 41 L52 45" stroke={FUR} strokeWidth="4" strokeLinecap="round" />
        </g>
      );

    case 'defeated':
      // Flat, narrow, unblinking. Not sad — furious that you won.
      return (
        <g>
          <rect x="30" y="44" width="17" height="5" rx="2.5" fill={EYE} />
          <rect x="53" y="44" width="17" height="5" rx="2.5" fill={EYE} />
          <circle cx="38.5" cy="46.5" r="2.2" fill={FUR} />
          <circle cx="61.5" cy="46.5" r="2.2" fill={FUR} />
        </g>
      );

    default:
      return blink;
  }
}

function Mouth({ mood }: { mood: CatMood }) {
  switch (mood) {
    case 'unhinged':
      return <ellipse cx="50" cy="59" rx="6.5" ry="5" fill={EYE} />;
    case 'greedy':
      // Open mouth mid-chew, tongue out.
      return (
        <g>
          <path d="M43 56 q7 7 14 0 Z" fill={EYE} />
          <path d="M47 60 q3 5 6 0 Z" fill="#ff8fa3" />
        </g>
      );
    case 'smug':
      return (
        <path d="M44 56 q6 5 12 0" fill="none" stroke={EYE} strokeWidth="2.5" strokeLinecap="round" />
      );
    case 'kind':
      return (
        <path d="M45 56 q5 4 10 0" fill="none" stroke={EYE} strokeWidth="2.5" strokeLinecap="round" />
      );
    case 'sulking':
    case 'defeated':
      // A hard flat line. The cat has nothing to say and says it.
      return <rect x="43" y="57" width="14" height="3" rx="1.5" fill={EYE} />;
    case 'stuffed':
      return <ellipse cx="50" cy="58" rx="4" ry="3" fill={EYE} />;
    case 'asleep':
      return <ellipse cx="50" cy="58" rx="3" ry="2.4" fill={EYE} />;
    default:
      return <path d="M46 56 h8 l-4 4 Z" fill={EYE} />;
  }
}

export function CatFace({
  mood,
  behaviour,
  className = '',
}: {
  mood: CatMood;
  behaviour: { blinks: boolean; twitches: boolean; drums: boolean; tail: boolean };
  className?: string;
}) {
  const flatEars = mood === 'sulking' || mood === 'defeated';

  return (
    <svg
      viewBox="0 0 112 84"
      className={`h-24 w-28 shrink-0 ${className}`}
      role="img"
      aria-label={`Cat, ${mood}`}
    >
      {/* tail — pokes up from behind the ledge and flicks when it has energy */}
      {behaviour.tail && (
        <path
          d="M92,80 q16,-4 12,-20 q-2,-9 -8,-9"
          fill="none"
          stroke={FUR}
          strokeWidth="6"
          strokeLinecap="round"
          className={behaviour.twitches ? 'cat-flick' : undefined}
        />
      )}

      <g className={behaviour.twitches ? 'cat-part cat-sway' : undefined}>
        {/* whiskers first, so they sit behind the head and spill onto the card */}
        <g stroke={FUR} strokeWidth="2" strokeLinecap="round">
          <line x1="7" y1="47" x2="34" y2="50" />
          <line x1="7" y1="56" x2="34" y2="55" />
          <line x1="93" y1="47" x2="66" y2="50" />
          <line x1="93" y1="56" x2="66" y2="55" />
        </g>

        <Ears flat={flatEars} />

        {/* head: rounded dome, flat bottom, peeking over the ledge */}
        <path d="M14,66 V46 a36,33 0 0 1 72,0 V66 Z" fill={FUR} />

        <Eyes mood={mood} />
        <Mouth mood={mood} />
      </g>

      {/* paws gripping the ledge; they drum when the cat is being fed */}
      <g fill={FUR}>
        {[27, 34, 41, 53, 60, 67].map((x, i) => (
          <rect
            key={x}
            x={x}
            y="60"
            width="6"
            height="18"
            rx="3"
            className={behaviour.drums ? 'cat-part cat-drum' : undefined}
            style={behaviour.drums ? { animationDelay: `${i * 70}ms` } : undefined}
          />
        ))}
      </g>

      {/* mood props */}
      {mood === 'asleep' && (
        <g fill={FUR} fontFamily="ui-monospace, monospace" fontWeight="700">
          <text x="82" y="20" fontSize="13" className="cat-part cat-float">z</text>
          <text x="91" y="12" fontSize="9" className="cat-part cat-float" style={{ animationDelay: '600ms' }}>
            z
          </text>
        </g>
      )}
      {mood === 'sulking' && (
        <path d="M80,22 q4,7 0,9 q-4,-2 0,-9 Z" fill="#bfe6ff" stroke={FUR} strokeWidth="1.5" />
      )}
    </svg>
  );
}
