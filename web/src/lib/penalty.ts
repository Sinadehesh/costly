/**
 * Pure money/penalty math. All amounts are integer cents.
 * Keep this module free of IO so it stays trivially testable.
 */

/** Share of every penalty that is permanently captured ("the burn"). */
export const BURN_SHARE = 0.2;

/** Minutes of verified walking owed per minute of scrolling. */
export const SWEAT_RATIO = 2;

/** Hours the purgatory hold survives before capture. */
export const REDEMPTION_WINDOW_HOURS = 24;

/** Companion-app liveness ping interval. */
export const DEVICE_HEARTBEAT_HOURS = 12;

/** 2 consecutive missed pings ⇒ the dead man's switch fires. */
export const BREACH_AFTER_HOURS = 2 * DEVICE_HEARTBEAT_HOURS;

/** Warn the user this far into the silence, before the switch fires. */
export const HEARTBEAT_WARNING_AFTER_HOURS = 18;

/**
 * Reinstall-to-cure. After the 24h threshold the breach is only PENDING; the
 * charge lands this many hours later, and any ping in between cancels it.
 * A dead battery, a holiday without a charger, or a week in airplane mode
 * looks identical to deletion from the server's side — this is the difference
 * between a fair charge and a chargeback.
 */
export const BREACH_GRACE_HOURS = 12;

/** Deletion fee bounds: €0 (allowed, discouraged) … €1000. */
export const MAX_DELETION_FEE_CENTS = 100_000;

/** Number of anchor tiers in the escalation ladder. */
export const ANCHOR_TIER_COUNT = 5;

/**
 * The user states what one hour of their time is worth; the meter charges
 * exactly that, minute by minute. Floored at 1 cent so the rate is never 0.
 */
export function perMinuteRateCents(hourlyRateCents: number): number {
  return Math.max(1, Math.round(hourlyRateCents / 60));
}

export interface PenaltySplit {
  totalCents: number;
  burnCents: number; // 20% — captured immediately, permanent
  purgatoryCents: number; // 80% — held for REDEMPTION_WINDOW_HOURS
}

export function splitPenalty(totalCents: number): PenaltySplit {
  const burnCents = Math.round(totalCents * BURN_SHARE);
  return { totalCents, burnCents, purgatoryCents: totalCents - burnCents };
}

/** Billable seconds → penalty, clamped to the user's per-session hard cap. */
export function sessionPenaltyCents(
  activeSeconds: number,
  rateCentsPerMin: number,
  capCents: number,
): { penaltyCents: number; capReached: boolean } {
  const raw = Math.round((activeSeconds / 60) * rateCentsPerMin);
  return { penaltyCents: Math.min(raw, capCents), capReached: raw >= capCents };
}

export function requiredWalkingMinutes(activeSeconds: number): number {
  return Math.ceil((activeSeconds / 60) * SWEAT_RATIO);
}

/** "You have burned 2.4% of your AirPods." */
export function anchorPercent(penaltyCents: number, anchorPriceCents: number): number {
  if (anchorPriceCents <= 0) return 0;
  return Math.round((penaltyCents / anchorPriceCents) * 1000) / 10;
}

/**
 * Taunt mechanic: which anchor tiers has the meter newly crossed?
 * Returns the tiers whose price is now covered by the running penalty and
 * that haven't been taunted yet this session, so each item fires its
 * "Thank you for buying us [Product Name]" exactly once.
 */
export function newlyCrossedTiers(
  penaltyCents: number,
  lastTauntTier: number,
  anchors: { tierLevel: number; priceCents: number }[],
): { tierLevel: number; priceCents: number }[] {
  return anchors
    .filter((a) => a.tierLevel > lastTauntTier && a.priceCents <= penaltyCents)
    .sort((a, b) => a.tierLevel - b.tierLevel);
}

/** True once the device has been silent long enough to count as a breach. */
export function isHeartbeatBreached(lastHeartbeatAt: Date | null, now: Date): boolean {
  if (!lastHeartbeatAt) return false; // never armed — no ping baseline yet
  return now.getTime() - lastHeartbeatAt.getTime() > BREACH_AFTER_HOURS * 3600_000;
}

/**
 * True in the warning band: silent long enough to warn, but not yet breached.
 * Deliberately excludes the already-breached case — past 24h the user gets the
 * breach path, not a "you're about to be charged" note.
 */
export function isHeartbeatWarning(lastHeartbeatAt: Date | null, now: Date): boolean {
  if (!lastHeartbeatAt) return false;
  const silentMs = now.getTime() - lastHeartbeatAt.getTime();
  return (
    silentMs >= HEARTBEAT_WARNING_AFTER_HOURS * 3600_000 &&
    silentMs <= BREACH_AFTER_HOURS * 3600_000
  );
}

/**
 * Has a pending breach outlived its grace window? Only then does the card get
 * charged. `pendingSince` is when the sweep first saw the 24h threshold crossed.
 */
export function isGraceExpired(pendingSince: Date, now: Date): boolean {
  return now.getTime() - pendingSince.getTime() >= BREACH_GRACE_HOURS * 3600_000;
}

/**
 * Did the device come back after the breach was marked pending? A ping strictly
 * newer than the pending marker means the app is alive — the switch stands down.
 */
export function isBreachCured(
  lastHeartbeatAt: Date | null,
  pendingSince: Date,
): boolean {
  if (!lastHeartbeatAt) return false;
  return lastHeartbeatAt.getTime() > pendingSince.getTime();
}
