# Q&A prep — the questions that decide the meeting

Read these out loud before any call. The answers are written the length
they should be *spoken* — short. The instinct to over-explain a hard
question is what loses the room; a partner reads a long answer as
uncertainty.

---

## The alignment attack

This is the question you will get most often. Do not flinch and do not
hedge — you have a fifteen-year precedent and a version that is gentler
than it.

**"So you make money when your users fail?"**

> Yes — the same way Beeminder has for fifteen years. You pledge against a
> goal, you derail, they charge you and keep it. That's the business model,
> not a loophole, and their framing is the right one: you earn in proportion
> to the value delivered, because the pledge *is* the mechanism that makes
> the goal work. It also means the product can be free to start — a
> subscription wall in front of a behavior-change tool selects for the
> people who need it least.
>
> And mine is softer than theirs. A Beeminder derailment charge is gone.
> Eighty percent of a Costly charge is refundable inside 24 hours by going
> for a walk.

**"That still sounds like you're incentivized to make people fail."**

> Then I'd point at what the code actually does. There's a hard per-session
> cap that *ends the session* rather than continuing to bill — I've capped
> my own revenue per session in software. Eighty percent of every charge is
> designed to be given back. And there's a self-exclusion switch that
> strips all stakes with no friction. If I wanted to maximize extraction,
> those three things wouldn't exist.

**"What's your incentive to make the detection accurate, then? A false
positive is free money for you."**

> A wrongful charge costs me the user, a chargeback, and Stripe risk-scoring
> my account — that's expensive money, not free money. Structurally, the
> meter needs the screen on, the app in the foreground, the phone not
> dormant, and two of three independent signals agreeing before it counts a
> single second. No lone signal can charge a card.
>
> And the structure is the same deposit contract theirs is, with the same
> kind of clock: every session's 80% sits under a visible 24-hour countdown
> with a walking progress bar, and the contract itself runs a fixed 7 or 30
> days that the user picked. The one charge that lands instantly is the 20%
> burn — that's the piece resting purely on a detection algorithm, and it's
> where I'd put the accuracy work first. I'm also considering putting a
> short grace window on the burn so that nothing in the system is instant
> and unappealable.

Volunteering the narrow version of your own weak spot — *the 20%, not "the
whole trigger"* — is stronger than a general reassurance and stronger than
the over-broad concession. It shows you know your system precisely.

---

## The predation and ethics attack

**"Isn't this just gambling? Or a payday lender for attention?"**

> There's no upside and no chance element — a user can never win money
> from Costly. The only outcomes are "you pay nothing" and "you pay what
> you agreed to." That's the opposite structure from gambling, where the
> possibility of winning is the hook.

**"Would you let a nineteen-year-old with no income use this?"**

> Not at the stakes an adult with a salary would set, no. The rate is
> derived from what the user says an hour of their time is worth, there's a
> hard per-session cap, and there's a self-exclusion switch that strips all
> stakes with no friction. For the alpha I'm capping stakes deliberately
> low for everyone. Age and income gating is a real open question and I'd
> rather set that policy with advice than guess.

**"You charge people a fee for deleting your app? That can't be legal."**

> I'd push back on the framing. We don't impose a fee — we *suggest* a range,
> the user picks the number themselves, anywhere from zero to a thousand
> euros, and zero is an allowed choice. Then they sign a fixed-term
> contract, 7 or 30 days, with that number as the breach fee. Uninstalling
> mid-term is an early breach of a contract they wrote the price of.
>
> That's the same shape as an early-termination fee on a phone plan, a gym
> contract, or a lease break — well-trodden ground, not a novel penalty.
> The consent evidence is stored per contract: what they agreed to, the
> exact terms version, and when.

**"What happens when someone's phone dies in a drawer for two days?"**

> That's the real question, and it's a detection problem rather than a
> contract problem — a false breach, not an unfair term. Today the switch
> fires after two consecutive missed 12-hour windows, and session heartbeats
> count as proof of life, but a dead battery still looks like deletion.
> Before real cards I'm adding a warning email at around 18 hours of silence
> and a reinstall-to-cure grace window. Charging someone whose phone died is
> a chargeback machine and it deserves fixing before launch, not after.

Naming your own unmitigated risk, precisely, is the highest-trust move in
the meeting. It also pre-empts diligence finding it later.

---

## The product attack

**"What stops me from just uninstalling the app the first time it charges
me?"**

> Nothing, mechanically — and that's the honest answer. What exists is the
> breach fee you set yourself and signed a fixed term against, timestamped.
> It's the most fragile part of the design and it's the number one thing
> the alpha exists to measure. If people would rather delete than pay,
> that's a product-level finding I want in week six.

**"Isn't the best case that your product works, the user stops scrolling,
and then churns?"**

> That's the gym-membership shape, and gyms are a good business. People
> keep paying for the thing that stops them slipping, because they know
> they'd slip. The contract renewal flow is already built for exactly that
> — you finish a lock-in period and choose a new one. But I'd rather
> measure retention than assert it.

**"Who is this actually for?"**

> People who have already paid for a blocker and relapsed anyway. They've
> proven they'll pay, they've proven soft friction doesn't hold them, and
> they say so publicly in competitor app reviews. That's the first
> thousand and I can reach them without paid acquisition.

---

## The moat attack

**"Why won't Google or Apple just build this?"**

> Because a platform charging its own users money for using apps on its own
> platform is structurally unthinkable — it's a PR disaster and a
> regulatory one. They will keep shipping dashboards, which is the thing
> that already doesn't work. That's not a moat I built; it's one their
> position gives me.

**"You cited Beeminder — they've been at this fifteen years and they're
tiny. Doesn't that cap your outcome?"**

Expect this immediately after you use the precedent. Have the answer ready.

> Their ceiling isn't marketing, it's population. A commitment contract
> requires the user to *construct* one: pick a goal, quantify it, define
> success, wire up a data source, maintain it. So the market is bounded by
> people who already have an explicit quantified personal goal and the
> discipline to model it. That's a small, self-selecting group — which is why
> fifteen years of a working business model produced a small business.
>
> Costly has nothing to construct, because the problem states itself. "I
> scroll too much" isn't a goal anyone has to define — it's a complaint most
> smartphone owners volunteer unprompted, with no framework and no metric.
> After onboarding the user does nothing at all. They open Instagram and the
> meter runs.
>
> The precedent proves the monetization is viable and that app stores and
> processors tolerate it. It doesn't bound my market, because the setup
> burden that kept them niche is exactly what I removed.

If they press on the real constraint, concede the right one: it isn't
goal-definition, it's willingness to put a card down against your own
behavior. Narrower than "scrolls too much," and it's the first number the
alpha produces.

**"Why won't Opal or one sec add it in a sprint?"**

> They'd need three things at once: Play-compliant detection without
> AccessibilityService, the full Stripe authorization-hold lifecycle, and
> on-device health data for the redemption side. The detection engine alone
> is the hard part — and it's a companion app, which is a real product
> decision they'd have to make. It's not a sprint. And they've built their
> brands on gentleness; this mechanic is off-brand for them in a way that
> matters more than the engineering.

---

## The technical attack

**"How do you know someone is doomscrolling and not just holding their
phone?"**

> Three gates and a vote. Screen has to be on, the targeted app has to be
> in the foreground, the phone can't be dormant — and then at least two of
> three independent signals have to agree: the app pulling network data,
> the gyroscope's swipe-rhythm signature, and media audio. Network catches
> the gentle-thumb scroll the gyro misses; the gyro catches the cached
> scroll the network misses. No single signal can charge a card.

**"And is it accurate?"**

> The architecture is sound and the thresholds are first-pass estimates
> that need tuning on a real device matrix. That's week one to four, and
> it's where I'd put contractor money first — it's the surface where being
> wrong costs a user their money and me their trust.

Never claim tuned accuracy you don't have. This is the one place a partner
can verify you're bluffing, and it's the one where bluffing is fatal.

---

## The founder attack

**"You're a psychologist. Can you build this?"**

> It's built. Solo, in about five weeks — the backend, the payment
> lifecycle, and the Android companion. Before this I shipped OopsCupid,
> two Pipedrive products in three and five months, and a curriculum-gap
> platform. Building isn't the bottleneck.

**"Solo founder — who's your technical co-founder?"**

> I don't have one, and I'd take the right one. What I'd say is that the
> combination I already have is the rare part: I can build the product and
> I can run the randomized trial that proves it changes behavior. Most
> teams in this category have neither half.

**"Why you for this specific problem?"**

> My thesis was a within-subjects study, ninety-six participants, three
> conditions, on whether feedback changes behavior. Before that I ran two
> hundred interviews at a methamphetamine rehabilitation centre and my
> undergrad thesis was on attributional style in recovery outcomes.
> Compulsive behavior and measuring interventions against it is the thing
> I actually study. Costly is that finding built into a product — feedback
> only changes behavior when it carries a consequence.

---

## The questions with no good answer yet

Say "I don't know" and then say what would tell you. This is a strength at
pre-seed; pretending otherwise is not.

- **"What's your CAC?"** → No idea, no paid acquisition yet. The beachhead
  is reachable organically and that's the first thing I'd test.
- **"What's the effect size?"** → That's what weeks 9–12 are for. If I knew
  it, I'd be raising a seed, not applying to a program.
- **"Is this legal in the EU?"** → The design never takes custody of user
  money — Stripe holds it, I capture or cancel — so the licensing question
  doesn't arise. The breach fee is a user-priced early-termination term on a
  fixed contract, which is ordinary ground. What I don't know yet is
  narrower than "is it legal": whether the term survives unfair-terms
  scrutiny under 93/13/EEC, and how the 14-day distance-contract withdrawal
  right sits against a 7-day lock-in. Two questions for a lawyer, first line
  item in the ask.
- **"What if the redemption rate is terrible?"** → Then Costly is a
  punishment app and the ratio or the split is wrong, and I'd rather learn
  that in week six than in year two.

---

## Two things to say unprompted

1. **The status slide.** Volunteer that there are zero users and no charge
   has moved. If they find it instead of hearing it, every other number you
   gave becomes suspect.
2. **The risk table.** Hand it over before they ask. Partners spend the
   whole meeting hunting for what you're hiding; a founder who has already
   written it down changes what the rest of the conversation is about.
