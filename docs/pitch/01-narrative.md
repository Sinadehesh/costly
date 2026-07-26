# Costly — the written pitch

**Founder:** Sina Dehesh · Milan, Italy · sinadehesh@gmail.com ·
github.com/Sinadehesh/costly
**Stage:** pre-launch, pre-revenue. Built solo. Seeking accelerator +
pre-seed.

---

## 1. One line

**Costly makes doomscrolling cost real money — and gives most of it back
if you walk it off.**

Longer, for forms with a 250-character limit:

> Costly puts your own money at stake against your screen time. Open
> Instagram and a meter starts charging your card by the minute. Close it
> and 80% of the charge sits on hold for 24 hours — walk it off, verified
> by your phone's health data, and you get it back. Don't, and it's gone.

---

## 2. The problem

People do not scroll because they lack information. They scroll because
nothing happens when they do.

The average person spends **4h37m a day on a smartphone** and **~2h40m of
that on social media** ([Cropink, 2026](https://cropink.com/screen-time-statistics);
[SQ Magazine, 2026](https://sqmagazine.co.uk/social-media-screen-time-statistics/)).
Gen Z is at roughly 4 hours of social alone. Screen-time dashboards have
shipped on both major platforms since 2018. The numbers went **up**.

That is the whole thesis in one observation: **awareness has been solved
and it changed nothing.** Every user of every blocker already knows the
number. What they do not have is a consequence attached to the moment of
the behavior.

## 3. Why the existing tools fail

The category — Forest, Opal, one sec, Freedom, FocusMe, Digital
Wellbeing — runs on **soft friction**: a delay, a breathing screen, a
dying tree, a lock you can turn off. Every one of these is free to
dismiss. The user pays nothing to override it, so the override always
wins at the exact moment self-control is weakest.

Commitment-contract products do use money — stickK and Beeminder put cash
at stake — but against **self-reported, retrospective goals**. You tell
them later whether you kept your word. That works for "go to the gym
3×/week." It cannot work for a behavior that is unplanned, impulsive, and
happens forty times a day in two-minute bursts.

**Nobody has wired real-time automatic detection to a real payment rail.**
That is the gap Costly occupies.

## 4. The insight

Loss beats gain. Deposit contracts — where the user pledges their own
money and can lose it — are effective specifically because they "exploit
the power of loss aversion," and are markedly cheaper than reward-based
incentive schemes ([JMIR RCT, 2022](https://www.jmir.org/2022/10/e38339);
[Behavioural Public Policy](https://www.cambridge.org/core/journals/behavioural-public-policy/article/deposit-yes-please-the-effect-of-different-modes-of-assigning-reward-and-depositbased-financial-incentives-on-effort/8ABC6108548ABC0E701D5E83E8FD3E96)).
The same literature flags the catch: **uptake is the hard part** —
deposits need to be small, and people commit more effort when they *choose*
their own stake than when one is assigned.

Costly is built directly on both halves of that finding:

- **Loss, not reward.** The meter takes money. Nothing is earned.
- **The user sets their own stake.** They state what an hour of their time
  is worth; the per-minute rate is derived from it. Nothing is assigned.
- **The loss is made concrete, not abstract.** €4.20 is forgettable. The
  user names five things they actually want to buy at rising prices —
  coffee €5, book €25, dinner €80, AirPods €250, PS5 €500 — and the meter
  reports in those units: *"Thank you for buying us 8% of a PS5."* Losing
  a percentage of a specific object you want hurts in a way a euro figure
  does not.

## 5. How it works

1. **Set your rate.** "What is one hour of your time worth?" → divided by
   60 for the per-minute penalty. No income guessing.
2. **Name the hostages.** Five things you want, at rising prices. Losses
   are always displayed as a percentage of these, euros secondary.
3. **Sign the contract.** A lock-in period (7 or 30 days) and a deletion
   fee you choose. Card saved, consent timestamped.
4. **The companion app watches.** When a targeted app is in the
   foreground, a meter runs — but only while the screen is on and at least
   two of three engagement signals agree (the app pulling network data,
   the gyroscope's swipe-rhythm signature, media audio). No lone signal
   can charge a card.
5. **The session ends — the financial moment.** 20% is captured
   immediately, permanently: the burn. The other 80% goes onto a 24-hour
   pre-authorization hold: purgatory.
6. **Redemption, 2:1.** Every scrolled minute owes two verified walking
   minutes, read from Health Connect. Hit the goal inside 24 hours and the
   hold is cancelled — the money never leaves. Miss it and the hold is
   captured.
7. **The dead man's switch.** The app pings the backend every 12 hours.
   Two consecutive missed windows during lock-in — deleted app, revoked
   permissions — triggers the deletion fee you signed for.

The mechanic in one sentence: **scrolling converts into either money or
walking, and the user picks which.**

## 6. Why this is not a predatory app

Expect this question in the first two minutes of every meeting. The
answer is architectural, not rhetorical:

- **80% of every penalty is refundable by the user's own action.** The
  default path out is walking, not paying.
- **A hard per-session cap** (default €30) ends the session rather than
  continuing to bill. The cap converts money-bleed into lockout.
- **A self-exclusion path** that strips all stakes and leaves a plain free
  blocker, with no dark-pattern friction on that specific path — and the
  product drops its sarcastic voice entirely there and is kind.
- **The villain can lose, loudly.** A zero-burn day and an under-cap week
  trigger designed, celebratory defeat states. Winning is as produced as
  losing.
- **Consent evidence is stored per contract** (`acceptedAt`,
  `termsVersion`), because a charge nobody can prove was agreed to is
  indefensible.

The honest framing to use out loud: *the product's ideal end state for any
individual user is that it earns nothing from them.* Which is exactly why
the revenue model cannot be built on their failure — see §7.

## 7. Business model — the decision to make before you pitch

**What the code does today:** penalties become company revenue.

**The problem with that:** it is revenue that grows when the user fails.
Every partner will name it, and they will be right. It also puts the
product on the wrong side of the regulatory conversation before it starts.

**Three options:**

| | Model | ARPU | Alignment | Risk |
| --- | --- | --- | --- | --- |
| A | Penalties = revenue (today's build) | Highest | Bad — we profit from relapse | High: optics, regulatory, App Store |
| **B** | **Subscription €5–9/mo + penalties escrowed into the user's own savings pot toward their anchor item; small handling fee** | Medium | **Strong — we earn on subscription, not failure** | Medium: escrow may trigger EU e-money rules |
| C | Penalties to charity or anti-charity (stickK model) | Lowest | Clean | Payout ops overhead, weak unit economics |

**Recommendation: pitch B.** It fixes the alignment attack, and it makes
the hostage ladder literal in a way that is genuinely better product: the
money you lose to scrolling *actually buys the PS5*. The threat becomes
"you will buy this thing slowly and stupidly, in penalties, instead of
choosing to" — which is more interesting than "we take your money," and
strictly more defensible.

Keep A as the alpha mechanic (it is what is built, and it is testable at
small stakes), and be explicit that B is the shipped model. Confirm the
escrow legality first — §10.

## 8. Why now

- **Verified walking only became possible on-device.** Google's Fit REST
  API is deprecated; Health Connect is the Android path, and it is
  on-device only, so nothing server-side can poll it. The redemption loop
  is auditable now, and it requires a companion app to exist — which is
  also a barrier for anyone who wants to copy it as a pure web product.
- **Stripe's manual-capture holds make redeemable stakes possible without
  custody.** Authorization holds live ~7 days, so a 24-hour redemption
  window sits comfortably inside them. Costly never holds the money —
  which is the difference between a product and a licensing problem.
- **Play policy pushed everyone off the easy path.** Detection via
  AccessibilityService is restricted to accessibility uses. The compliant
  alternative — a multi-signal heuristic over UsageStats, network, and
  gyroscope — is real engineering, and it is already built and compiling.
- **The soft-tool category is mature and visibly not working.** Eight
  years of dashboards, rising usage. The market is ready for the version
  with teeth.

## 9. Market

- **Digital detox apps:** $498M (2025) → $1.38B (2032), 15.9% CAGR
  ([Valuates](https://reports.valuates.com/market-reports/QYRE-Auto-9Z18571/global-digital-detox-apps)).
- **Screen-time management software:** $3.8B (2025) → $9.7B (2034), 10.9%
  CAGR ([Dataintelo](https://dataintelo.com/report/screen-time-management-software-market)).

Those are context, not the argument. The argument is the beachhead:

**People who have already paid for a blocker and relapsed anyway.** They
have proven willingness to pay, proven dissatisfaction with soft friction,
and they self-identify in public — App Store reviews of Opal and one sec
are full of "I just turn it off." That is the first thousand users, and
they are reachable without paid acquisition.

`[NEEDS SOURCE]` — before submitting, build the bottom-up: paying users
across Opal / Freedom / one sec / FocusMe × plausible conversion. A
sourced bottom-up beats a borrowed TAM in every partner meeting.

## 10. Risks — named first, because they will be found anyway

| Risk | Status |
| --- | --- |
| A false positive charges someone unfairly | Mitigated by design: screen-on gate, 2-of-3 signal vote, per-session cap. **Open:** gyroscope thresholds are first-pass estimates and need on-device tuning before real cards. |
| Google Play rejection | Engineered off AccessibilityService already. **Open:** `specialUse` foreground services still draw manual review. |
| "You charged me for deleting an app" chargebacks | Consent evidence per contract; breach charge is idempotent. **Open:** needs an ~18h warning email and a reinstall-to-cure grace window — a phone dead in a drawer currently looks identical to deletion. |
| Escrow / holding user funds (model B) | **Open — blocking.** May trigger EU e-money or payment-institution rules. Needs a real legal opinion. Today's hold-only design avoids custody. |
| Gambling-adjacent perception | Structurally different: no upside, no chance element, the user cannot win money. Say it in those words. |
| iOS | Requires Apple's Family Controls entitlement (application + approval). Android-first is deliberate; iOS after the mechanic is validated. |
| Users delete rather than pay | **The single biggest unknown.** The deletion fee is the current answer and it is the most fragile part of the design. The alpha exists to measure this. |
| Solo founder | Real. Addressed in §12 by what has already shipped alone. |

## 11. Status — what is actually true today

Built solo between June and July 2026:

- **Backend** — Next.js App Router, Postgres via Prisma, ~20 API routes:
  onboarding, the full Stripe lifecycle (SetupIntent for off-session
  cards, the two-PaymentIntent burn/purgatory split, webhook
  reconciliation with an idempotency ledger), session start/heartbeat/end,
  redemption sync, dead-man's-switch and hold-expiry cron sweeps, a daily
  laziness penalty with per-user timezone handling, and a Stripe Checkout
  "settle up" recovery path for failed off-session charges.
- **Android companion** — Kotlin/Compose: Play-compliant heuristic
  detection engine, a live overlay meter that survives app switches,
  Health Connect walking harvest, per-device secret authentication,
  12-hour liveness worker with expedited opportunistic pings.
- **Integer cents everywhere.** No floats anywhere near money.
- **The APK compiles green in CI** as of 22 July 2026.

**What is not true yet, stated plainly:** zero users. No charge has ever
moved, in test mode or otherwise. The system has never run end-to-end on
real hardware. Web-side authorization is half-finished and there is no
test suite yet. The next milestone is the first live loop — deploy, real
device, one full burn → hold → walk → release cycle in Stripe test mode.

This is what four weeks of a program should close, and it is why the
timing of an accelerator is right rather than early.

## 12. Founder — why me

**Sina Dehesh.** MSc Applied Experimental Psychological Sciences,
University of Milano-Bicocca (91/110). Based in Milan.

The pitch for me is a specific and unusual pairing: **I can build the
product and I can run the experiment that proves it works.**

- **The experiment half.** My MSc thesis ran a within-subjects study,
  N=96, three conditions, analyzed with repeated-measures ANOVA and
  Holm-corrected post hoc tests, and found a significant effect (p=.009)
  of self-referential visual feedback on candidate expressiveness in
  automated interviews. Before that I co-designed and evaluated a
  psychological-safety intervention for factory workers, building the
  quantitative framework from validated instruments (MNRI-R, SRO) plus
  incident data. And I have done the fieldwork end of this domain: 200
  semi-structured interviews at a methamphetamine rehabilitation centre,
  analyzed with logistic regression — my BSc thesis was on attributional
  style and rehabilitation outcomes. Compulsive behavior and the
  measurement of interventions against it is not a new topic for me.
- **The shipping half.** Costly is not my first solo build. OopsCupid.com
  is live — a psychology-based assessment platform where I own concept,
  assessment design, UX, LLM integration, funnel, and SEO. I delivered a
  Pipedrive competitive-intelligence product in three months and a CRM
  data-entry automation product in five, both now in beta with users. I
  built Engineer Passway's two-source curriculum-gap data model. I shipped
  Daily Sublime — 30 issues of an email art magazine, on schedule, over
  six months, with n8n automation behind the growth loop.
- **The relevant credential nobody else in this category has.** Every
  competitor in digital wellbeing makes a correlational claim: usage went
  down among people who use our app. I can produce a **causal** one.

Why this product and not another: the mechanic is downstream of the thing
I actually study — that feedback changes behavior only when it carries
consequence. Costly is that finding, built.

## 13. The plan with you — 90 days

| Weeks | Work | Gate |
| --- | --- | --- |
| 1–4 | Close web authorization, build the money-math test suite, deploy, tune detection thresholds on real devices, add the dead-man's-switch grace rails | First full live loop in Stripe test mode on real hardware |
| 5–8 | Alpha with 30–50 recruited users, real cards, deliberately small stakes and low caps. Instrument everything. Legal opinion on the escrow model | Retention and redemption data; a decision on model B |
| 9–12 | **The study.** Randomized, three arms: awareness only vs. soft friction vs. Costly stakes. Primary outcome: daily minutes in targeted apps at week 4 against pre-install baseline | A causal effect size — the sales asset and the publication |

**Primary metric:** reduction in daily minutes in targeted apps, week 4 vs.
baseline.
**Health-of-the-loop metric:** redemption rate — the share of holds walked
off rather than captured. If that number is high, the product works as
designed. If it is low, Costly is a punishment app and needs rebalancing,
and I would rather learn that in week 6 than in year two.

## 14. The ask

Accelerator program plus pre-seed. Use of funds, in priority order:

1. **Legal and compliance** — the escrow opinion, terms, EU consumer-law
   review of the deletion fee. This gates the business model.
2. **The alpha cohort** — recruitment and the reimbursement pool that lets
   me run real cards ethically at small stakes.
3. **One Android contractor, part-time** — detection threshold tuning and
   device-matrix testing. The riskiest technical surface and the one where
   an extra pair of hands converts directly into fewer wrongful charges.
4. **The study** — instrumentation, incentives, analysis.

What I want from the program itself, beyond money: **payments and
regulatory introductions**, and pressure on the business-model decision in
§7 from people who have shipped consumer products that touch money.

---

## Appendix — CV bullet to update

Your CV still describes the v1 build. Replace the Costly entry with
something closer to:

> **Founder & Product Developer — Costly** · Jun 2026 – Present ·
> github.com/Sinadehesh/costly
> - Built a behavior-change product that puts real money at stake against
>   screen time: a Next.js/Postgres backend with the full Stripe
>   authorization-hold lifecycle, plus a Kotlin/Compose Android companion
>   that detects doomscrolling without AccessibilityService for Play
>   compliance.
> - Designed the redemption mechanic — 20% of each penalty captured, 80%
>   held for 24h and released against walking minutes verified through
>   Health Connect — grounding the model in loss-aversion and
>   deposit-contract research.
> - Owned the ethical constraints as product spec: per-session caps,
>   self-exclusion, stored consent evidence, and designed "user wins"
>   states.
