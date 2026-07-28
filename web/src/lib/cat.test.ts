import { describe, expect, it } from 'vitest';

import { catLine, catMood, catSkin } from './cat';

/**
 * The cat's mood is product behaviour, not decoration: it decides whether a
 * user who just walked off their debt is congratulated or gloated at. These
 * tests pin the priority ORDER, because every bug in this module looks like
 * the mascot being tone-deaf at the exact moment tone matters.
 */

describe('catMood priority', () => {
  it('never breaks character on the self-exclusion path', () => {
    // The one promise with no exceptions: on this path the villain drops the
    // act. Not even a €500 loss and an unarmed system may override it.
    expect(catMood({ penaltyCents: 50_000, kindMode: true })).toBe('kind');
    expect(catMood({ penaltyCents: 0, armed: false, kindMode: true })).toBe('kind');
    expect(catSkin({ penaltyCents: 50_000, kindMode: true }).taunts).toBe(false);
  });

  it('sleeps when nothing is armed, however much it has eaten', () => {
    // A cat gloating over money it cannot actually take is the app lying.
    expect(catMood({ penaltyCents: 9_999, armed: false })).toBe('asleep');
  });

  it('admits defeat when the debt is fully walked back', () => {
    // The regression this exists to prevent: someone scrolls €40, walks all of
    // it off, and still gets the gloating face because cents outranked victory.
    expect(catMood({ penaltyCents: 4_000, walkingPct: 100 })).toBe('defeated');
    expect(catSkin({ penaltyCents: 4_000, walkingPct: 100 }).tone).toBe('gold');
    expect(catSkin({ penaltyCents: 4_000, walkingPct: 100 }).taunts).toBe(false);
  });

  it('does not celebrate a victory that never happened', () => {
    // 100% of nothing owed is not a win — it's a user who hasn't started.
    expect(catMood({ penaltyCents: 0, walkingPct: 100 })).toBe('waiting');
  });

  it('sulks once the user is more than halfway back', () => {
    expect(catMood({ penaltyCents: 4_000, walkingPct: 60 })).toBe('sulking');
    expect(catSkin({ penaltyCents: 4_000, walkingPct: 60 }).taunts).toBe(false);
  });

  it('falls through to the greed tiers only when nothing else applies', () => {
    expect(catMood({ penaltyCents: 50 })).toBe('smug');
    expect(catMood({ penaltyCents: 500 })).toBe('greedy');
    expect(catMood({ penaltyCents: 2_000 })).toBe('unhinged');
    expect(catMood({ penaltyCents: 20_000 })).toBe('stuffed');
  });

  it('defaults to armed so a bare penalty still reads as a greed tier', () => {
    expect(catMood({ penaltyCents: 500 })).toBe('greedy');
  });
});

describe('catLine', () => {
  it('attacks a named wishlist item when taunting is allowed', () => {
    expect(catLine({ penaltyCents: 2_000 }, 'PlayStation')).toContain('PlayStation');
  });

  it('falls back to pure taunts with no wishlist — a blank list is supported', () => {
    const line = catLine({ penaltyCents: 2_000 }, null);
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toContain('undefined');
  });

  it('is deterministic, so a taunt does not reshuffle on every render', () => {
    expect(catLine({ penaltyCents: 2_000 }, null)).toBe(catLine({ penaltyCents: 2_000 }, null));
  });

  it('drops the act entirely in kind mode', () => {
    const line = catLine({ penaltyCents: 50_000, kindMode: true }, 'PlayStation');
    expect(line).not.toContain('PlayStation');
    expect(line).toContain('Take care of yourself');
  });

  it('congratulates rather than taunts on a completed walk', () => {
    const line = catLine({ penaltyCents: 4_000, walkingPct: 100 }, 'PlayStation');
    expect(line).toContain('safe');
  });

  it('never comments on the user as a person, only the behaviour', () => {
    // The voice rule from the spec: mock the BEHAVIOUR, never self-worth.
    const banned = /\b(loser|pathetic|worthless|stupid|weak|failure|disgusting you)\b/i;
    const contexts = [
      { penaltyCents: 0 },
      { penaltyCents: 50 },
      { penaltyCents: 900 },
      { penaltyCents: 4_000 },
      { penaltyCents: 90_000 },
      { penaltyCents: 4_000, walkingPct: 100 },
      { penaltyCents: 4_000, walkingPct: 60 },
      { penaltyCents: 100, armed: false },
      { penaltyCents: 100, kindMode: true },
    ];
    for (const ctx of contexts) {
      expect(catLine(ctx, 'PlayStation')).not.toMatch(banned);
      expect(catSkin(ctx).line).not.toMatch(banned);
    }
  });
});
