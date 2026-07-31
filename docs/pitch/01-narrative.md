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
3. **Sign the contract.** A fixed term — 7 or 30 days — and an early-breach
   fee the user sets themselves from a suggested range (€0–€1000; €0 is
   allowed, and labelled "Not Recommended"). Card saved, consent timestamped
   against the exact terms version.
4. **The companion app watches.** When a targeted app is in the
   foreground, a meter runs — but only while the screen is on and at least
   two of three engagement signals agree (the app pulling network data,
   the gyroscope's swipe-rhythm signature, media audio). No lone signal
   can charge a card.
5. **The session ends — the financial moment.** 20% is captured
   immediately and permanently: the burn. It does not come back, because the
   time didn't either. The other 80% goes onto a 24-hour pre-authorization
   hold: purgatory. Costly never holds money — Stripe does — and the 80% is
   a refund the user can *earn*, not a deposit we are keeping for them.
6. **Redemption, 2:1.** Every scrolled minute owes two verified walking
   minutes, read from Health Connect. Hit the goal inside 24 hours and the
   hold is cancelled — the money never leaves. Miss it and the hold is
   captured.
7. **The dead man's switch.** The app pings the backend every 12 hours.
   Two consecutive missed windows during lock-in — deleted app, revoked
   permissions — is an early breach of the term, and the fee the user
   priced themselves applies.

The mechanic in one sentence: **scrolling converts into either money or
walking, and the user picks which.**

## 6. Why this is not a predatory app

Expect this question in the first two minutes of every meeting. The
answer is architectural, not rhetorical:

- **80% of every penalty is a refund the user can earn.** The default path
  out is walking, not paying — and Costly never holds that money; it sits as
  an authorization on the user's own card until it is cancelled or captured.
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

The honest framing to use out loud: *the default path out of every charge is
a walk, not a payment.* We earn when the mechanism was needed and the user
chose not to use it — which is the same place Beeminder has earned for
fifteen years (§7), except that ours is 80% refundable and theirs is not.

## 7. Business model — penalties are the revenue, and that is a precedented model

**Penalties become company revenue.** That is what the code does and it is
what we pitch. It is not a novel or an awkward position: it is how the
longest-running product in this category has worked for over a decade.

**The direct precedent is Beeminder.** Users pledge money against a goal;
when they derail, Beeminder charges them and **keeps it**. That is
explicitly the business model, not a side effect — and their own framing of
it is the argument to borrow: *the company makes money in proportion to how
much value the user gets*, because the pledge is the entire mechanism that
makes the goal work. They are deliberately pledge-focused **rather than**
subscription-focused, which lets anyone start for free instead of hitting a
paywall ([Beeminder strategy memo](https://blog.beeminder.com/focus/);
[Beeminder FAQ](https://www.beeminder.com/faq)).

Worth stealing from them, too: their pledge escalates on a fixed ladder —
$0 → 5 → 10 → 30 → 90 → 270 → 810 → 2430 → 7290 — stepping up on each
derailment, **up to a user-set cap**
([Beeminder help](https://help.beeminder.com/article/20-how-much-do-i-pledge-on-my-goals)).
That is fifteen years of evidence for escalating, self-chosen, capped
stakes, and it maps cleanly onto the rate ladder.

The adjacent wagering products monetize failure through a rake instead:
StepBet takes ~15% of a pot funded by the players who miss their goal;
DietBet takes 10–25% ([StepBet](https://sidehusl.com/stepbet/);
[DietBet breakdown](https://www.mymoneyblog.com/dietbet-profit-numbers-breakdown.html)).
Weaker precedents for us — they are peer-to-peer, so the company never
holds the forfeit — but they establish that app stores and payment
processors have been fine with failure-funded consumer health products for
years.

**Why this is the right answer for Costly specifically, not just the
precedented one:**

1. **The villain needs skin in the game.** The product's entire dramatic
   premise is an antagonist that profits when you scroll and *can lose*
   when you don't. Route the money into the user's own savings pot and the
   antagonist has no stake in the outcome — Costly collapses into a savings
   app with a mean voice. The persona is not decoration; it is the
   retention mechanic, and it only works if the threat is real.
2. **It avoids the regulatory problem rather than creating one.** Escrowing
   penalties into a user-owned pot means holding customer funds, which is
   what triggers EU e-money and payment-institution questions. Today's
   design never takes custody — Stripe holds, we capture or cancel. The
   simpler revenue model is also the simpler licensing position.
3. **Our version is already gentler than the precedent.** A Beeminder
   derailment charge is 100% gone. In Costly, 80% of every penalty is
   walkable back inside 24 hours, and the default path out is exercise, not
   payment. We are strictly softer than the model that has run for fifteen
   years without being called predatory.
4. **Nobody gets priced out.** Like Beeminder, penalty-funded means the
   product can be free to start. A subscription wall in front of a
   behavior-change tool selects for the people who need it least.

**Optional later, not in the pitch:** a paid tier for analytics, multi-device,
and longer contracts. Additive, never the primary line.

### Where the real risk actually sits

Not in *earning from failure*. And not in a missing deadline either —
Costly has two, both signed for in advance and both visible:

- **The 24-hour redemption window** on every session's 80% hold, shown on
  the dashboard as a live countdown next to a walking-progress bar. This is
  the Beeminder shape exactly: a deadline the user watches approach, with a
  known action that clears it.
- **The contract term** — 7 or 30 days, chosen at onboarding, which the
  breach fee runs against.

So the bulk of the money — the 80% — behaves like a deposit contract with a
visible clock, which is the well-precedented part.

### The 20% is not a rough edge. It is the mechanism.

Say this deliberately, because it will be misread as one:

**The 20% burn is gone the moment the session ends, permanently, and that is
the design.** Costly holds no money at any point — Stripe holds the 80%, and
we either cancel it or capture it. The 80% is not the user's money in
escrow; it is **a refund they can earn**.

Two reasons the burn has to be irreversible:

1. **A loss that can be fully undone was never a loss.** Loss aversion needs
   a realized one. If every euro is recoverable by walking, the meter is a
   threat rather than a consequence, and the user learns that scrolling is
   free as long as they pay in steps afterwards.
2. **The time is not refundable, so the money shouldn't be either.** A user
   who scrolls forty minutes and then walks it off has still lost forty
   minutes of their life. Refunding 100% would tell them the session cost
   nothing, which is a lie. The burn is the honest residue of the part that
   genuinely cannot be given back — and the user has to *see* that something
   was lost.

It also carries the unit economics: the burn is the only captured money per
session, so it has to clear the card-processing cost. **Model this before
launch** — EU card fees run roughly 1.5% + €0.25, so on a small session the
fixed component dominates and a €1 burn is mostly fee. That is an argument
for a session-level minimum or for aggregating small sessions, not for
changing the split.

### The residual exposure, stated precisely

Not that the burn is unappealable — that is intentional and defensible.
The exposure is that **if detection is wrong, the burn is an unrecoverable
wrongful charge.** No product mechanism fixes that; two things do:

- **Detection accuracy.** Threshold tuning is the first line item in the ask
  for exactly this reason.
- **A support policy, not a product path.** Manual goodwill refunds on
  demonstrated false positives, handled case by case and never advertised as
  a route. Users cannot plan around it, so the mechanic stays intact — but
  the answer to "you charged me for a wobble in a car mount" is a human, not
  a shrug. Every payment business runs this; write it down before the first
  real card.

This is a **detection-accuracy problem, not an ethics-of-revenue problem**.
It is why the per-session cap, the 2-of-3 signal vote, and the stored
consent evidence are load-bearing rather than nice-to-have — and why none of
the fix belongs in the split.

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

Those are context, not the argument. There are two real arguments.

### Why this market is structurally larger than the commitment-contract market

Every existing money-at-stake product requires the user to **construct a
contract**: pick a goal, quantify it, define what success means, wire up a
data source, maintain it. That is the ceiling on Beeminder and stickK, and
it is not a marketing problem — it is a population problem. The market for
commitment contracts is bounded by *people who already have an explicit,
quantified personal goal and the discipline to model it*. That is a small,
self-selecting group, which is why fifteen years of a working business model
produced a small business.

**Costly has nothing to construct, because the problem states itself.**
"I scroll too much" is not a goal a user has to define — it is a complaint
most smartphone owners already volunteer, unprompted, with no framework and
no metric. There is no target to set, no graph to maintain, no data source
to connect. After onboarding the user does nothing at all: they open
Instagram and the meter runs.

That is the difference between a tool for people who think in metrics and a
product aimed at a near-universal behavior. The precedent proves the
monetization works; it does not bound the market, because the setup burden
that kept it niche is the exact thing Costly removes.

### The beachhead

**People who have already paid for a blocker and relapsed anyway.** They
have proven willingness to pay, proven dissatisfaction with soft friction,
and they self-identify in public — App Store reviews of Opal and one sec
are full of "I just turn it off." That is the first thousand users, and
they are reachable without paid acquisition.

**The honest caveat, for the alpha to answer:** the funnel constraint is not
goal-definition, it is willingness to put a card down against your own
behavior. That is a narrower gate than "scrolls too much," and no amount of
market sizing substitutes for measuring it. It is the first number the alpha
produces.

### The ladder, at €100 per customer per year

All three layers price the customer at **€100/year** and filter on the
constraints the product actually has today.

| | Who | Filter applied | Customers | At €100/yr |
| --- | --- | --- | --- | --- |
| **TAM** | Adult smartphone users in card-mature markets (EU-27, UK, US, CA, AU) | want to cut their screen time | ~345M | **€34.5B** |
| **SAM** | Of those, EU-27 + UK only | on Android | ~125M | **€12.5B** |
| **SOM** | Of SAM | 10% capture | 12.5M | **€1.25B** |

Derivation, so every step can be attacked separately:

- Adult smartphone users: EU-27 + UK ≈ **380M**; adding US, Canada and
  Australia ≈ **690M**. `[NEEDS SOURCE]`
- **~50%** say they want to reduce their screen time. `[NEEDS SOURCE]` —
  this is the softest number in the ladder and the one to source first.
- **~66%** Android share in Europe (StatCounter). `[NEEDS SOURCE — pull the
  current month]`
- SAM is EU-first because the contract is written against EU consumer law
  and the companion is Android-only. Both constraints lift with build
  effort, which is what makes SAM→TAM a roadmap rather than a wish.

### What €100 a year assumes about behaviour

Costly keeps 20% of every penalty permanently, plus the 80% that goes
unredeemed. So revenue per user is `total penalties × (0.2 + 0.8 × (1 −
redemption rate))`, and €100 of revenue implies:

| If users walk off… | €100/yr requires penalties of |
| --- | --- |
| everything (100% redeemed) | €500/yr |
| half | €167/yr |
| nothing | €100/yr |

**€100 is a conservative number, and it is worth saying so out loud.** At a
€15/hour self-set rate the meter charges €0.25/minute, so €167/year of
penalties is under two billable minutes a day. Anyone still scrolling 40
minutes a day past their free allowance generates that in a week.

The reason not to model the aggressive number: **this product destroys its
own revenue when it works.** A user who quits scrolling stops paying. €100
is therefore best defended as the *steady state of a working product* —
someone who relapses occasionally, walks most of it off, and re-signs —
rather than as a monetization target. That framing turns the obvious
partner objection ("your revenue falls if you succeed") into the number
already being in the model.

It also assumes re-contracting: contracts run 7 or 30 days, so €100/year is
roughly four 30-day contracts at €25, not one annual charge. Retention
across contract boundaries is a real assumption and the alpha measures it.

### Why 10% of SAM is the wrong SOM to present

12.5M customers and €1.25B is the arithmetic answer, and it is in the table
above because it was asked for. It should not go on a slide. "10% of the
market" is the single most discounted claim in venture pitching — it asserts
a share rather than deriving one, and a partner reads it as evidence that
nobody has thought about distribution.

Apply the same 10% to the **beachhead** instead, and it becomes defensible:

- Digital detox apps are a **$498M** category today (Valuates, cited above).
  EU + UK is roughly a quarter of it, so ≈ **€115M** of existing spend.
- At €40–60/year typical subscription pricing, that implies **~2M people in
  EU + UK already paying for screen-time control.** `[NEEDS SOURCE — verify
  against Opal / Freedom / one sec / Forest disclosed subscriber counts]`
- **10% of proven payers = 200,000 customers × €100 = €20M ARR.**

Same capture assumption, one-sixtieth the claim, and it is anchored to a
figure already sourced in this section. It also matches the beachhead
argument above: these are people who have already paid for a blocker and
relapsed anyway.

A three-year path to it, which is what the €20M actually means:

| | Customers | ARR |
| --- | --- | --- |
| Year 1 | 5,000 | €500K |
| Year 2 | 40,000 | €4M |
| Year 3 | 200,000 | €20M |

**The number that is not in any of this** is what share of people will
attach a card against their own behaviour. Every layer above assumes it away.
It is the first thing the alpha measures, and no sizing exercise substitutes
for it.

## 10. Risks — named first, because they will be found anyway

| Risk | Status |
| --- | --- |
| A false positive charges someone unfairly | Mitigated by design: screen-on gate, 2-of-3 signal vote, per-session cap. **Open:** gyroscope thresholds are first-pass estimates and need on-device tuning before real cards. |
| Google Play rejection | Engineered off AccessibilityService already. **Open:** `specialUse` foreground services still draw manual review. |
| "You charged me for deleting an app" chargebacks | Consent evidence per contract; breach charge is idempotent. **Open:** needs an ~18h warning email and a reinstall-to-cure grace window — a phone dead in a drawer currently looks identical to deletion. |
| Holding user funds | Avoided by design — Stripe holds, we capture or cancel; Costly never takes custody. Stays true as long as we do not escrow penalties into a user-owned pot (§7). |
| EU consumer law on the breach fee | Framed correctly it is ordinary ground: the user is *suggested* a range, sets the amount themselves (€0–€1000, zero allowed), then signs a fixed 7- or 30-day term with that number as the early-breach fee — the shape of a phone-plan termination fee or a lease break, not an imposed penalty. Self-pricing and the permitted €0 both help the unfair-terms analysis. **Open:** whether the term survives Directive 93/13/EEC scrutiny. |
| The 14-day withdrawal right | Handled the right way — at onboarding we take **express consent to performance beginning immediately plus an acknowledgement**, which is the statutory mechanism under the Consumer Rights Directive (2011/83/EU) and should be captured regardless. **The wrinkle to raise with the lawyer:** for *services*, that exception generally bites once the service is **fully performed** inside the 14 days. A 7- or 30-day monitoring contract is arguably ongoing rather than fully performed on day one, and consumer statutory rights typically cannot be waived by agreement — only the specific statutory exception can be triggered, within its limits. If the right survives, a mid-term withdrawal may reduce what is recoverable to a **pro-rata** amount for service actually supplied, rather than the full breach fee. Ask this precisely; it may argue for the 30-day term as the default. *(Not legal advice — the point is to walk in with the right question.)* |
| Gambling-adjacent perception | Structurally different: no upside, no chance element, the user cannot win money. Say it in those words. |
| iOS | Requires Apple's Family Controls entitlement (application + approval). Android-first is deliberate; iOS after the mechanic is validated. |
| Users delete rather than pay | **The single biggest unknown.** The self-priced breach fee is the current answer. Enforceable and precedented as a contract term — but whether it actually holds someone in at the moment they want out is behavioral, not legal, and only the alpha answers it. |
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
| 5–8 | Alpha with 30–50 recruited users, real cards, deliberately small stakes and low caps. Instrument everything. Legal opinion on the deletion fee and the contract terms | Retention and redemption data; a defensible contract |
| 9–12 | **The study.** Randomized, three arms: awareness only vs. soft friction vs. Costly stakes. Primary outcome: daily minutes in targeted apps at week 4 against pre-install baseline | A causal effect size — the sales asset and the publication |

**Primary metric:** reduction in daily minutes in targeted apps, week 4 vs.
baseline.
**Health-of-the-loop metric:** redemption rate — the share of holds walked
off rather than captured. If that number is high, the product works as
designed. If it is low, Costly is a punishment app and needs rebalancing,
and I would rather learn that in week 6 than in year two.

## 14. The ask

Accelerator program plus pre-seed. Use of funds, in priority order:

1. **Legal and compliance** — an EU unfair-terms review of the breach fee,
   and whether an ongoing 7-day monitoring term counts as "fully performed"
   for the immediate-performance exception to the 14-day withdrawal right.
   Two specific questions, not open-ended risk.
2. **The alpha cohort** — recruitment and the reimbursement pool that lets
   me run real cards ethically at small stakes.
3. **One Android contractor, part-time** — detection threshold tuning and
   device-matrix testing. The riskiest technical surface and the one where
   an extra pair of hands converts directly into fewer wrongful charges.
4. **The study** — instrumentation, incentives, analysis.

What I want from the program itself, beyond money: **payments and
regulatory introductions**, and time with people who have shipped consumer
products that charge cards on an automated trigger — the trigger is where my
risk lives (§7), not the revenue model.

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
