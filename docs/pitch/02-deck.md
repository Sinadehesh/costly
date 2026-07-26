# Costly — deck (13 slides, ~8 minutes)

Format: one idea per slide, big type, no paragraphs. Speaker notes are what
you *say*; the slide text is what they *read*. Never the same words.

Design: use the product's own tokens so the deck looks like the app —
bg `#0B0D0A`, surface `#151812`, money-green `#2EDB6A`, burn red-orange
`#FF3B2F` for the meter only, gold `#F5B940` for user-win states, text
`#F2F4EF`. Monospace for every number. Dark only.

---

### 1 — Title

> # COSTLY
> ### Doomscrolling, with a price tag.
> Sina Dehesh · Milan

**Say:** "I built an app that charges your card while you scroll
Instagram. If you go for a walk afterwards, you get most of it back. I'll
explain why that second half is the whole product."

---

### 2 — The problem

> ## 4h 37m a day.
> Screen-time dashboards shipped in 2018.
> The number went **up**.

**Say:** People aren't uninformed. Everyone in this room can recite their
own screen time. Awareness got solved and it changed nothing — which means
awareness was never the constraint.

**Sources on slide, small:** Cropink 2026; SQ Magazine 2026.

---

### 3 — Why every current tool fails

> ## Soft friction is free to dismiss.
> Forest. Opal. one sec. Freedom. Digital Wellbeing.
> A delay. A breathing screen. A dying tree. A lock you can turn off.
> **Overriding costs the user nothing.**

**Say:** So the override wins at the exact moment self-control is weakest.
The tools that *do* use money — stickK, Beeminder — stake it against
goals you report on later. That works for the gym. It cannot work for a
behavior that's impulsive, unplanned, and happens forty times a day in
two-minute bursts.

---

### 4 — The insight

> ## Loss moves people. Gain doesn't.
> Deposit contracts work *because* of loss aversion — and cost a fraction
> of reward schemes.
> But: the stake must be **small**, and **self-chosen**.

**Say:** That last line is from the same literature and it's the design
constraint most of this category ignores. So in Costly the user states
what an hour of their time is worth and the rate comes from that. Nothing
is assigned to them. And the loss isn't abstract — €4.20 is forgettable,
so they name five things they actually want to buy, and the meter reports
in those units.

**Visual:** the hostage ladder — coffee €5 → book €25 → dinner €80 →
AirPods €250 → PS5 €500.

---

### 5 — The moment

> ### *"Thank you for buying us 8% of a PlayStation."*
> — the notification, mid-scroll

**Say:** This is the product. Not a dashboard you check on Sunday — a
hostile little message the second you cross a threshold, naming the thing
you're not going to get. Everything else is plumbing for this moment.

**Visual:** the live overlay meter over a phone screen, mono digits
ticking. One image, no text.

---

### 6 — How it works

> 1. State your hourly rate → per-minute penalty
> 2. Name five things you want
> 3. Sign a contract — lock-in + deletion fee. Card saved.
> 4. Scroll a targeted app → the meter runs
> 5. Session ends → **20% charged. 80% held for 24 hours.**
> 6. Walk 2 minutes per scrolled minute, verified → **hold released**
> 7. Don't → captured

**Say:** Step 5 and 6 are the design. The money doesn't vanish — it goes
into purgatory, on a card hold, for a day. Scrolling converts into either
money or walking, and the user chooses which. Walking is the default path
out.

---

### 7 — "Isn't this predatory?"

> ## 80% of every penalty is refundable by the user.
> Hard per-session cap → the session ends, billing stops.
> Self-exclusion switch → all stakes gone, no friction on that path.
> The app celebrates loudly when you beat it.
>
> **The ideal outcome for any user is that we earn nothing from them.**

**Say:** I put this slide seventh because it's the question everyone asks
second, and it deserves a structural answer, not a reassurance. Which is
also why the revenue model can't be built on their failure — next slide.

---

### 8 — Business model

> **Subscription €5–9/month.**
> Penalties go into the user's **own savings pot**, toward the thing they
> named. We take a handling fee.
>
> We earn when you subscribe. Not when you slip.

**Say:** And it makes the threat better, not weaker: "you're going to buy
that PS5 anyway — slowly, stupidly, in penalties, instead of choosing to."
The current build routes penalties to us; I think that's the wrong
long-term answer and I'd want to pressure-test the switch with you.
[**Decide before pitching — see narrative §7.**]

---

### 9 — Why now

> **Health Connect** — verified walking data exists on-device, and only
> on-device. Redemption became auditable, and it requires a companion app.
> **Stripe manual-capture holds** — hold money for 7 days without ever
> holding money. No custody, no licence.
> **Play policy** — the easy detection path is closed. The compliant one
> is real engineering. It's built.
> **Category fatigue** — eight years of soft tools, usage still climbing.

**Say:** None of these were true three years ago. The redeemable stake is
only implementable now.

---

### 10 — Market & beachhead

> Digital detox apps: **$498M → $1.38B** by 2032 (15.9% CAGR)
> Screen-time management software: **$3.8B → $9.7B** by 2034
>
> ### First thousand users:
> **people who already paid for a blocker and relapsed anyway.**

**Say:** Proven willingness to pay, proven dissatisfaction with soft
friction, and they self-identify in public — competitor App Store reviews
are full of "I just turn it off." Reachable without paid acquisition.

---

### 11 — Status

> **Built solo, June–July 2026.**
> Backend: Next.js + Postgres, ~20 routes, full Stripe hold/capture
> lifecycle, webhook reconciliation, cron sweeps.
> Android: Kotlin/Compose, Play-compliant detection, live overlay,
> Health Connect, dead man's switch.
> APK green in CI, 22 July.
>
> **Zero users. No charge has moved yet.**
> Next milestone: first live loop on real hardware.

**Say:** I'm not going to show you a fake retention chart. The system is
built and it has never run end-to-end — that's the four-week gate, and
it's precisely why the timing of a program is right rather than early.

**Note:** this slide earns more trust than an invented number would. Do
not soften it.

---

### 12 — Founder

> ## I can build it *and* prove it works.
> MSc Applied Experimental Psychological Sciences, Milano-Bicocca.
> Thesis: within-subjects, **N=96**, 3 conditions, RM-ANOVA,
> Holm-corrected, **p=.009**.
> 200 clinical interviews on compulsive behavior + logistic regression.
> Shipped solo and on schedule: OopsCupid.com · two Pipedrive products
> (3 and 5 months) · Engineer Passway · 30 issues of Daily Sublime.
>
> Every competitor makes a correlational claim.
> I can make a **causal** one.

**Say:** That last line is the real asset. Nobody in digital wellbeing can
say "we ran the randomized trial." I've run one, on a harder outcome, and
I built this whole system myself.

---

### 13 — The plan, and the ask

> **Weeks 1–4** — harden, deploy, tune detection → first live loop
> **Weeks 5–8** — 30–50 user alpha, real cards, small stakes → retention
> and redemption data; legal opinion on escrow
> **Weeks 9–12** — randomized 3-arm study: awareness vs. soft friction vs.
> stakes → **effect size**
>
> **Primary metric:** daily minutes in targeted apps, week 4 vs. baseline.
> **Health metric:** redemption rate — % of holds walked off.
>
> ### The ask
> Program + pre-seed → legal/compliance · alpha cohort · part-time Android
> contractor · the study.
> From you specifically: **payments and regulatory introductions**, and
> pressure on slide 8.

**Say:** If the redemption rate comes back low, Costly is a punishment app
and needs rebalancing — and I'd rather find that out in week six than in
year two. That's what I want the program for.

---

## Cut order, if you're over time

1. Slide 10's market figures → keep only the beachhead line
2. Slide 9 → fold "why now" into one sentence on slide 6
3. Slide 4's citations → say them instead of showing them

**Never cut:** slide 5 (the moment), slide 7 (not predatory), slide 11
(honest status), slide 12 (founder).

## Backup slides to have ready, not shown

- The detection architecture — the 2-of-3 signal vote and the screen-on
  gate. For the technical partner who asks how you avoid false charges.
- The two-PaymentIntent diagram — why partial capture forces two intents.
  This one detail proves you've actually built payments, not sketched them.
- The risk table from narrative §10, verbatim. Producing it *before* being
  asked is the single strongest trust move available in a pitch.
