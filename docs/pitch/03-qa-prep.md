# Q&A prep — the questions that decide the meeting

Read these out loud before any call. The answers are written the length
they should be *spoken* — short. The instinct to over-explain a hard
question is what loses the room; a partner reads a long answer as
uncertainty.

---

## The alignment attack

**"So you make money when your users fail?"**

> Today's build does, and I think that's wrong. The model I want to ship is
> subscription revenue, with penalties going into the user's own savings
> pot toward the thing they named. We earn when they subscribe, not when
> they slip. It also makes the threat sharper: you're going to buy that
> PS5 anyway — slowly and stupidly, in penalties, instead of choosing to.

Do not get defensive here. Naming it as a decision you've already
identified is stronger than defending the current code.

**"What's your incentive to make the detection accurate, then? A false
positive is free money for you."**

> Under the subscription model it isn't — a wrongful charge costs me a
> subscriber and a chargeback. That's the alignment argument in practice.
> Structurally: the meter needs the screen on, the app in the foreground,
> and two of three independent signals agreeing before it counts a single
> second. And every session is capped.

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

**"What happens when someone's phone dies in a drawer for two days and you
charge them a deletion fee?"**

> Right now that's a real hole and I know exactly where it is. The switch
> only fires after two consecutive missed 12-hour windows, and session
> heartbeats count as proof of life — but a dead battery still looks like
> deletion. Before real cards I'm adding a warning email at around 18
> hours of silence and a reinstall-to-cure grace window. Charging someone
> whose phone died is a chargeback machine and it deserves fixing before
> launch, not after.

Naming your own unmitigated risk, precisely, is the highest-trust move in
the meeting. It also pre-empts diligence finding it later.

---

## The product attack

**"What stops me from just uninstalling the app the first time it charges
me?"**

> Nothing, mechanically — and that's the honest answer. What exists is the
> deletion fee you signed for at onboarding, with the consent timestamped.
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
- **"Is this legal in the EU?"** → The hold-only design avoids custody, so
  today I think yes. The escrow model may trigger e-money rules and I want
  a real opinion before I promise it. That's the first line item in the
  ask.
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
