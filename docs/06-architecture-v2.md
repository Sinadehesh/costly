# Costly v2 — Architecture (ACTIVE)

> Supersedes the v1 local-first Android plan (docs 01–05, kept as the
> parking lot). v2 is a mobile-first **web app** with real money moving
> through Stripe, plus an Android companion service for detection.

## Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend/DB**: Next.js API routes, Prisma ORM, PostgreSQL
- **Payments**: Stripe — pre-authorization holds & captures
- **Device**: Android heuristic spy engine — UsageStatsManager
  (foreground app) + gyroscope (doomscroll motion), **no
  AccessibilityService** for Play compliance — plus Health Connect
  (verified walking minutes)
- **Scheduling**: Vercel Cron (or any plain cron) hitting
  `/api/jobs/expire-holds` — no automation platform

## Mechanics

1. **Explicit hourly rate** — the user states what one hour of their
   time is worth; the system divides by 60 for the per-minute penalty
   rate. No income guessing.
2. **Escalating product anchors ("the hostage ladder")** — 5 items at
   rising price tiers (coffee €5 → book €25 → dinner €80 → AirPods
   €250 → PS5 €500). Losses are displayed as % of these items, not raw
   euros.
3. **The taunt mechanic** — when the live meter crosses the exact price
   of an anchor item, the device fires a hostile notification/overlay:
   *"Thank you for buying us [Product Name]."* Each tier fires exactly
   once per session (`Session.lastTauntTier`).
4. **Vice meter + idle detection** — AccessibilityService watches
   `TYPE_VIEW_SCROLLED`; 60s without a scroll pauses the timer (no
   charging sleepers). Hard cap per session (default €30) terminates
   the session — no catastrophic chargebacks.
5. **20/80 split** — session ends → 20% permanently captured ("the
   burn"), 80% held in purgatory for 24h.
6. **Sweat equity, 2:1** — every scroll-minute owes 2 verified walking
   minutes. Goal met in 24h → hold released. Deadline missed → hold
   captured.
7. **The deletion penalty (dead man's switch)** — at onboarding the
   user signs a commitment contract: a lock-in period (7 or 30 days)
   and a breach fee (€0–€1000; €0 allowed but labeled "Not
   Recommended"). The companion app pings the backend every 12h. Two
   consecutive missed pings (>24h silence) during lock-in = the app was
   deleted or its permissions revoked → the full deletion fee is
   charged off-session. After lock-in: free cancel, or renew for a new
   period (a new contract row with fresh consent evidence).

## Stripe design decisions (engineering, not negotiable wishes)

- **Two PaymentIntents per session, not one.** Stripe cannot partially
  capture a PaymentIntent and keep the remainder on hold — a partial
  capture auto-releases the rest. So: burn PI (20%, automatic capture)
  + purgatory PI (80%, `capture_method: manual`). Redemption success →
  `paymentIntents.cancel`; expiry → `paymentIntents.capture`.
- **Off-session charges require a saved card**: SetupIntent with
  `usage: "off_session"` at onboarding; the meter refuses to arm
  without a saved payment method. SCA (3DS) can still decline
  off-session confirms → sessions need a "settle up" fallback state.
- **Auth holds live ~7 days** on most cards, so the 24h window is safe.
- **Integer cents everywhere.** No float euros anywhere in the system.
- **Webhook reconciliation** is the source of truth backstop, with an
  idempotency ledger (`WebhookEvent`) so retried deliveries never
  double-capture.
- **The breach charge is idempotent per contract**
  (`idempotencyKey: breach_{contractId}`), so a crash between the
  Stripe charge and the DB write cannot double-charge on the next
  sweep. Consent evidence (`acceptedAt`, `termsVersion`) is stored on
  every contract — a "you charged me for deleting an app" chargeback
  dispute is won or lost on that record.

## Known platform risks (tracked, not blocking)

- **Google Fit REST API is deprecated** (sunset announced; Health
  Connect is the Android path). Health Connect is on-device only —
  nothing server-side can poll it — so the companion app must push
  walking minutes to `/api/redemptions/:id/sync`. HealthKit likewise
  has no server API; iOS needs on-device sync when it lands.
- **Foreground detection without AccessibilityService** (done). To stay
  Play-compliant the app uses a heuristic engine — `UsageStatsManager`
  for the foreground app + gyroscope for doomscroll motion — instead of
  an AccessibilityService (which Play restricts to accessibility uses).
  Trade-off: Usage Access carries ~1–2s latency, and the gyroscope
  doomscroll inference needs on-device threshold tuning before live
  cards, since a false positive bills a user for a wobble (bounded by
  the per-session cap). `specialUse` foreground services still draw
  Play review.
- **Dead-man's-switch false positives.** A dead battery, a week
  offline, or Android's Doze killing WorkManager looks identical to
  deletion from the server's side. Mitigations built in: the app pings
  opportunistically (launch + every session event, not just the 12h
  worker), session heartbeats count as proof of life, and the switch
  only arms after the first ping. Recommended before real users:
  a warning email at ~18h of silence and a short reinstall-to-cure
  window — charging a user whose phone died in a drawer is a
  chargeback machine.

## Data model

See `web/prisma/schema.prisma` — User (explicit hourly rate, last
heartbeat), AnchorItem (5-tier hostage ladder, unique per user+tier),
CommitmentContract (ACTIVE → COMPLETED | CANCELLED | BREACHED, with fee
+ consent evidence per lock-in period), Session (ACTIVE → HOLD →
RELEASED | CAPTURED, plus lastTauntTier), RedemptionTask (PENDING →
SUCCESS | FAILED), WebhookEvent.

## API surface

See `web/README.md` for the full route table and the session lifecycle
sequence.

## UI surfaces (to scaffold next)

1. **Onboarding flow** — hourly-rate input → rate reveal → 5-tier
   anchor ladder entry → commitment contract (lock-in + deletion fee,
   €0 shown as "Not Recommended") → card save (SetupIntent).
2. **Live meter** — ticking elapsed time, euro amount, anchor-% burned,
   taunt overlays as tiers are crossed.
3. **Purgatory dashboard** — active holds, 24h countdown, walking
   progress bar, contract status ("Lock-in ends in 3 days. The switch
   is armed.").
