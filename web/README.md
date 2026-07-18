# Costly — web app

Next.js (App Router) + Prisma + PostgreSQL + Stripe.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL + Stripe keys
npx prisma migrate dev
npm run dev
```

The expiry sweep is scheduled in `vercel.json` (every 10 min). On Vercel's
Hobby plan crons are limited to once daily — if that's too coarse, point any
plain scheduler (system cron, GitHub Actions schedule) at
`GET /api/jobs/expire-holds` with `Authorization: Bearer $CRON_SECRET`.

## API routes

```
src/app/api/
├── onboarding/route.ts                    POST  create user (explicit hourly
│                                                rate → per-minute rate), 5-tier
│                                                anchor ladder, commitment
│                                                contract, Stripe customer
├── dashboard/route.ts                     GET   aggregate Purgatory view:
│                                                contract, holds + redemptions,
│                                                walking totals, armed state
├── stripe/
│   ├── setup-intent/route.ts              POST  SetupIntent (usage: off_session)
│   │                                            → frontend vaults the card
│   ├── setup-complete/route.ts            POST  server-verified write-back of
│   │                                            the vaulted payment method
│   │                                            (webhook's belt-and-braces twin)
│   └── webhook/route.ts                   POST  Stripe events: saves payment
│                                                method, reconciles session state,
│                                                idempotent via WebhookEvent
├── device/
│   └── heartbeat/route.ts                 POST  12h liveness ping — the dead
│                                                man's switch lifeline; replies
│                                                with contract state
├── contracts/
│   └── [contractId]/
│       ├── cancel/route.ts                POST  free exit, ONLY after lock-in
│       │                                        has been served
│       └── renew/route.ts                 POST  new lock-in period (new row,
│                                                fresh consent evidence)
├── sessions/
│   ├── start/route.ts                     POST  device: blocked app foregrounded;
│   │                                            refuses to arm w/o saved card
│   └── [sessionId]/
│       ├── heartbeat/route.ts             POST  device: billable-seconds delta
│       │                                        (idle-filtered); replies running
│       │                                        total + capReached + taunts
│       │                                        (anchor tiers newly crossed)
│       └── end/route.ts                   POST  THE financial moment: burn PI
│                                                (20%, captured) + purgatory PI
│                                                (80%, manual-capture hold) +
│                                                RedemptionTask (2:1, 24h)
├── redemptions/
│   └── [taskId]/sync/route.ts             POST  walking minutes (cumulative);
│                                                goal met in time → cancel hold
│                                                → RELEASED
└── jobs/
    ├── expire-holds/route.ts              GET   scheduled sweep (Vercel Cron /
    │                                            any cron): past-deadline
    │                                            PENDING → capture hold →
    │                                            CAPTURED/FAILED
    └── check-heartbeats/route.ts          GET   dead man's switch sweep:
                                                 ACTIVE contracts — lock-in
                                                 served → COMPLETED; >24h of
                                                 ping silence → BREACHED +
                                                 deletion-fee charge
```

## Pages

- `/` — landing: the pitch, one CTA ("Sign the contract").
- `/onboarding` — 4-step wizard: hourly rate (live per-minute preview) →
  hostage ladder (5 ascending tiers) → the contract (lock-in +
  deletion-fee slider; €0 triggers the "Not Recommended" warning) →
  the vault (Stripe Elements + SetupIntent, `redirect: 'if_required'`,
  then server-verified write-back via `/api/stripe/setup-complete`).
- `/dashboard` — the Purgatory view: active contract with the deletion
  fee and lock-in countdown, purgatory wallet (holds + per-session
  capture countdowns), sweat-equity progress bar (gold at 100%), the
  hostage ladder, and the UNARMED banner with the companion-app
  download prompt until the first device heartbeat lands.

Identity is `localStorage['costly:userId']` until real auth lands —
every API route carries a `TODO(auth)`.

## Session lifecycle

```
device: vice app opened
  → POST /api/sessions/start                          Session ACTIVE
  → POST /api/sessions/:id/heartbeat (every ~30s)     accumulate billable time
      idle ≥60s? device sends delta=0 (timer paused)
      capReached? device force-closes the app
  → POST /api/sessions/:id/end                        Session HOLD
      burn PI      20%  capture_method: automatic  → charged now
      purgatory PI 80%  capture_method: manual     → pre-auth hold
      RedemptionTask: required = 2 × scroll minutes, deadline = +24h

then, one of two endings:
  walk completed in time
  → POST /api/redemptions/:taskId/sync                goal met
      stripe.paymentIntents.cancel(purgatory)         Session RELEASED ✓
  deadline passes
  → cron → GET /api/jobs/expire-holds
      stripe.paymentIntents.capture(purgatory)        Session CAPTURED ✗
```

Why two PaymentIntents: Stripe cannot capture 20% of a hold and keep the
other 80% authorized — partial capture releases the remainder. Splitting
into a burn intent and a purgatory intent is the only clean way to get
"20% gone now, 80% redeemable" semantics.

## Dead man's switch (deletion penalty)

```
onboarding: contract signed
  deletionFeeCents (€0..€1000), lockinEndsAt (+7d or +30d)   Contract ACTIVE

companion app: POST /api/device/heartbeat every 12h
  (plus opportunistic pings on launch + every session event;
   session heartbeats also count as proof of life)

hourly: cron → GET /api/jobs/check-heartbeats, per ACTIVE contract:
  lockinEndsAt passed                → COMPLETED  (switch disarms)
  lastHeartbeatAt > 24h old          → BREACHED   (2 missed pings =
    off-session charge of deletionFeeCents,        deleted app or revoked
    idempotencyKey breach_{contractId})            permissions mid-lock-in)
  lastHeartbeatAt null               → skipped    (arms on first ping)

after lock-in: POST /api/contracts/:id/cancel  → CANCELLED (free)
               POST /api/contracts/:id/renew   → new ACTIVE contract row
```

## Money

Integer cents everywhere (`hourlyRateCents`, `penaltyRateCentsPerMin`,
`deletionFeeCents`, …). Pure math lives in `src/lib/penalty.ts` — no IO,
unit-test it hard.
