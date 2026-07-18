# COSTLY

**A high-stakes habit-reversal app that makes doomscrolling expensive —
then makes you walk it off.**

Costly charges you real money per minute of doomscrolling (Instagram,
TikTok, …) at the hourly rate you set for your own time, frames every
loss against a 5-tier ladder of products you actually want (coffee →
book → dinner → AirPods → PS5, taunting you as the meter crosses each
price), and lets you earn 80% of it back through verified physical
exercise: 2 minutes of walking for every minute scrolled, within 24
hours. And because you'll be tempted to delete it when it hurts, you
sign a commitment contract at onboarding: delete the app (or revoke its
permissions) during your lock-in period and a dead man's switch charges
your self-chosen deletion fee.

## Architecture (v2 — ACTIVE)

Mobile-first **Next.js web app** + Android companion service.

- Next.js (App Router) + Tailwind · Prisma + PostgreSQL · Stripe
  pre-auth holds & captures · Android AccessibilityService for scroll
  detection · Health Connect/HealthKit for walking verification ·
  Vercel Cron (or any plain cron) for the expiry sweep.
- **20/80 split**: session ends → 20% captured permanently, 80% held in
  purgatory for 24h; released on walking-goal success, captured on
  expiry. Two PaymentIntents per session (Stripe can't partial-capture
  and keep the rest held).
- Full architecture: `docs/06-architecture-v2.md`.

## Repo map

- `web/` — the app: `prisma/schema.prisma`, API routes
  (`web/README.md` has the route table + session lifecycle diagram).
- `docs/` — `06-architecture-v2.md` is current; docs 01–05 are the v1
  local-first Android plan, kept as the parking lot (villain voice &
  ethics specs there still inform v2 copy).
- `mobile-native/` — parked v1 Expo scaffold; will be reworked into the
  Android companion service (AccessibilityService + heartbeat client).
- `CLAUDE.md` — v1 master prompt (superseded where it conflicts with
  `docs/06-architecture-v2.md`).

## Status

| Piece | State |
| --- | --- |
| Prisma schema (User / AnchorItem / CommitmentContract / Session / RedemptionTask / WebhookEvent) | ✅ |
| API routes: onboarding, setup-intent, session lifecycle + taunts, redemption sync, webhook | ✅ scaffolded |
| Dead man's switch: device heartbeat, breach sweep, contract cancel/renew | ✅ scaffolded |
| Cron schedules (`web/vercel.json`: expire-holds, check-heartbeats) | ✅ |
| UI: landing, 4-step onboarding (Stripe Elements vault), purgatory dashboard | ✅ scaffolded |
| UI: live meter view (web overlay/widget) | ⬜ next |
| Android companion service (AccessibilityService + heartbeat worker) | ⬜ |
| Companion app → health-minutes push wiring | ⬜ |
| Breach warning email + reinstall-to-cure grace flow | ⬜ recommended |
