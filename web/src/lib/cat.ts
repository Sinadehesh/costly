/**
 * THE CAT'S BRAIN. Pure — no React, no IO — so its behaviour is testable and
 * so the rules live in one place instead of scattered through JSX.
 *
 * The old cat had one input (how much money it had eaten) and three faces. It
 * therefore had nothing to say about the states that actually matter: the
 * system being unarmed, the user walking their debt off, the user WINNING.
 * The product spec is explicit that "the villain can lose" and that "winning
 * must feel as designed as losing" — a mascot driven only by cents can't do
 * that, because from its point of view winning and never-started look the same.
 *
 * So mood is derived from context, and the ordering below is the design:
 * safety first, then victory, then greed.
 */

export type CatMood =
  | 'kind' // self-exclusion: the act drops entirely
  | 'asleep' // not armed — nothing is being watched
  | 'defeated' // the user beat it. GOLD.
  | 'sulking' // the user is walking the debt back and will make it
  | 'waiting' // armed, fed nothing yet
  | 'smug' // < €1
  | 'greedy' // < €10
  | 'unhinged' // < €50
  | 'stuffed'; // ≥ €50

export interface CatContext {
  /** Money the cat has taken. Drives the greed tiers. */
  penaltyCents: number;
  /** Has a device ever pinged? Unarmed means the meter is theatre. */
  armed?: boolean;
  /** Redemption progress, 0–100. */
  walkingPct?: number;
  /**
   * Self-exclusion. On this path the villain is never sarcastic — the spec
   * forbids it, and it is the one promise that has to hold without exception.
   */
  kindMode?: boolean;
}

export interface CatSkin {
  mood: CatMood;
  /** Card background token. Gold is reserved for the user winning. */
  tone: 'slate' | 'amber' | 'orange' | 'red' | 'gold' | 'calm';
  /** The cat's own line — short, spoken, never about the user's worth. */
  line: string;
  /** Whether a taunt about the user's money is allowed at all. */
  taunts: boolean;
  /** Idle behaviour hints the component turns into animation classes. */
  behaviour: {
    blinks: boolean;
    twitches: boolean;
    /** Paws drumming the ledge: impatience, and later, feeding frenzy. */
    drums: boolean;
    /** Tail visible and flicking above the ledge. */
    tail: boolean;
  };
}

const SKINS: Record<CatMood, Omit<CatSkin, 'mood'>> = {
  kind: {
    tone: 'calm',
    line: 'Okay. No games.',
    taunts: false,
    behaviour: { blinks: true, twitches: false, drums: false, tail: false },
  },
  asleep: {
    tone: 'slate',
    line: 'Wake me when it counts.',
    taunts: false,
    behaviour: { blinks: false, twitches: true, drums: false, tail: true },
  },
  defeated: {
    tone: 'gold',
    line: 'Fine. TAKE it.',
    taunts: false,
    behaviour: { blinks: true, twitches: true, drums: false, tail: true },
  },
  sulking: {
    tone: 'slate',
    line: 'You are actually walking. Gross.',
    taunts: false,
    behaviour: { blinks: true, twitches: true, drums: false, tail: true },
  },
  waiting: {
    tone: 'slate',
    line: 'I am patient. And hungry.',
    taunts: false,
    behaviour: { blinks: true, twitches: true, drums: false, tail: true },
  },
  smug: {
    tone: 'amber',
    line: 'More please.',
    taunts: true,
    behaviour: { blinks: true, twitches: true, drums: false, tail: true },
  },
  greedy: {
    tone: 'orange',
    line: 'Yum.',
    taunts: true,
    behaviour: { blinks: true, twitches: true, drums: true, tail: true },
  },
  unhinged: {
    tone: 'red',
    line: "That's so much money.",
    taunts: true,
    behaviour: { blinks: false, twitches: true, drums: true, tail: true },
  },
  stuffed: {
    tone: 'red',
    line: 'I cannot move. Worth it.',
    taunts: true,
    behaviour: { blinks: false, twitches: false, drums: false, tail: false },
  },
};

/**
 * Mood priority, highest first. Each rung exists for a reason:
 *
 * 1. kindMode  — self-exclusion outranks everything. Not negotiable.
 * 2. !armed    — an unarmed system is theatre; a cat gloating over money it
 *                cannot actually take would be lying to the user.
 * 3. walked it — the user won. This has to beat the greed tiers, or somebody
 *                who scrolled €40 and then walked all of it back would still
 *                be shown a gloating cat. Losing has to be visible to the cat.
 * 4. nothing   — armed and unfed.
 * 5. walking   — halfway back. The cat is annoyed, not triumphant.
 * 6. greed     — only now does the money decide the face.
 */
export function catMood(ctx: CatContext): CatMood {
  const { penaltyCents, armed = true, walkingPct = 0, kindMode = false } = ctx;

  if (kindMode) return 'kind';
  if (!armed) return 'asleep';
  if (walkingPct >= 100 && penaltyCents > 0) return 'defeated';
  if (penaltyCents <= 0) return 'waiting';
  if (walkingPct >= 50) return 'sulking';
  if (penaltyCents < 100) return 'smug';
  if (penaltyCents < 1_000) return 'greedy';
  if (penaltyCents < 5_000) return 'unhinged';
  return 'stuffed';
}

export function catSkin(ctx: CatContext): CatSkin {
  const mood = catMood(ctx);
  return { mood, ...SKINS[mood] };
}

/** Kept for the existing snack-tier call sites. */
export function snackTier(penaltyCents: number): 1 | 2 | 3 {
  if (penaltyCents < 100) return 1;
  if (penaltyCents < 1000) return 2;
  return 3;
}

const PURE_TAUNTS = [
  'Spent it on dirty socks and a dead pigeon. No refunds.',
  'I bought a rock with your money. The rock is my friend now.',
  'Your money is gone. I ate the receipt.',
  'I put it all in a hole. Great hole. You paid for it.',
  'Bought seventeen identical spoons. Needed none of them.',
  'Converted it into a small pile. I sit on the pile.',
  'Funded my enemies. Long story. Your money though.',
];

/** Deterministic pick so the taunt doesn't reshuffle on every render. */
function pureTaunt(seed: number): string {
  return PURE_TAUNTS[Math.abs(seed) % PURE_TAUNTS.length];
}

/**
 * The line under the cat's own. Note what this never does: comment on the
 * user as a person. The villain mocks the BEHAVIOUR and celebrates the spite —
 * "you are weak" is off the menu, permanently.
 */
export function catLine(ctx: CatContext, wishlistItem?: string | null): string {
  const mood = catMood(ctx);

  switch (mood) {
    case 'kind':
      return 'The stakes are off. No fee, no meter, no jokes. Take care of yourself.';
    case 'asleep':
      return 'Nothing is being watched. Pair a device or this is all just a screensaver.';
    case 'defeated':
      return wishlistItem
        ? `You walked it all back. Your ${wishlistItem} is safe. I am not upset. I am FINE.`
        : 'You walked every minute of it back. I got nothing. Do not enjoy this.';
    case 'sulking':
      return 'Halfway. Your money is halfway out of my paws and I hate it.';
    case 'waiting':
      return 'Nothing yet. The meter is armed and the day is young.';
    default:
      return wishlistItem
        ? `I took your ${wishlistItem} money!`
        : pureTaunt(Math.floor(ctx.penaltyCents / 100));
  }
}

/** Back-compat shim for the old two-argument signature. */
export function tauntLine(penaltyCents: number, wishlistItem?: string | null): string {
  return catLine({ penaltyCents }, wishlistItem);
}
