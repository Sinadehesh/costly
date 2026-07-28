# What to actually send, and to whom

Read this before building anything. The instinct is "write a deck and attach
it everywhere" — that is the wrong artifact for the program at the top of your
list.

## What each kind of program accepts

| Programme | What it takes | The deck? |
| --- | --- | --- |
| **Antler** (day-zero: Berlin, Amsterdam, Munich) | Web form: residency choice, name, email, LinkedIn, **CV**, written motivation answers, sometimes a short video | **Not required.** They say so. The interviews read the founder — background, motivation, whether you work well under pressure in a team |
| **EF (Entrepreneur First)** | Same shape: form + interviews on you, not the idea | Not required |
| **Techstars / Seedcamp / most seed accelerators** | Form + **deck** + sometimes a demo video | Yes — the 13-slider in `02-deck.md` |
| **Cold email to an individual investor** | Short email + **one-pager** attached | One-pager first; deck on request |

So there are three artifacts, not one:

1. **The CV** — Antler's actual required file. You have one; its Costly entry
   is out of date (fix below).
2. **The one-pager** — the universal attachment. Drafted in full below.
3. **The deck** — already written, `02-deck.md`.

---

## 1. The CV (Antler's required file)

Antler reads the CV as the primary evidence, so the Costly line has to describe
what exists now, not the first sketch. Replacement bullet is in
`01-narrative.md`'s appendix.

Two things to check before uploading:

- **The shipping record is the story.** Five products delivered solo inside a
  year, two on fixed timelines. Make sure that reads as a pattern, not a list.
- **The thesis belongs near the top.** N=96, three conditions, RM-ANOVA,
  Holm-corrected, p=.009 — it is the least replaceable thing on the page and it
  is currently buried under employment history.

File name: `Sina-Dehesh-CV.pdf`

---

## 2. The one-pager

**One page. No second page.** If it does not fit, cut the market section, then
the roadmap. Never cut the status or the founder line.

### Structure

| Block | Length | What it does |
| --- | --- | --- |
| Header | 1 line | Name, one-line description, contact, repo |
| The problem | 2 sentences | Awareness is solved; consequence isn't |
| The product | 3 sentences + the loop | What actually happens, concretely |
| Why it isn't punishment | 2 sentences | Pre-empts the first objection |
| Why now | 3 bullets | Health Connect, Stripe holds, Play policy |
| Market | 2 lines | Beachhead, not TAM theatre |
| Model | 2 lines | Penalty-funded, with the precedent named |
| Status | 3 lines | Honest. Built / not yet run |
| Founder | 2 lines | Builds it AND can prove it works |
| Ask | 1 line | Programme + what the money does |

### Draft — copy this

> ### COSTLY — doomscrolling with a price tag
> Sina Dehesh · Milan · sinadehesh@gmail.com · github.com/Sinadehesh/costly
>
> **The problem.** People spend 4h37m a day on their phones and ~2h40m of it on
> social. Screen-time dashboards have shipped since 2018 and the number went up:
> awareness was solved and it changed nothing. What is missing is a consequence
> attached to the moment of the behaviour.
>
> **The product.** You state what an hour of your time is worth and name five
> things you want to buy. Open Instagram and a meter charges your card by the
> minute, reporting the damage as "8% of a PlayStation" rather than €4.20. When
> the session ends, 20% is gone permanently and 80% sits on a 24-hour card hold.
> Walk two minutes for every minute scrolled — verified through Health Connect —
> and the hold is cancelled. Miss it and it's captured.
>
> **Why it isn't a punishment app.** 80% of every penalty is a refund you can
> earn, the default way out is a walk rather than a payment, and a hard
> per-session cap ends the session instead of billing on. The 20% is permanent
> on purpose: the scrolled time doesn't come back either, and a loss you can
> fully undo was never a loss.
>
> **Why now.**
> · Health Connect made verified walking auditable, and on-device only — so
>   redemption requires a companion app, which is a barrier to copying.
> · Stripe's manual-capture holds let stakes be redeemable without ever taking
>   custody of user money — a product instead of a licensing problem.
> · Play policy closed the easy detection path; the compliant multi-signal
>   engine is real engineering, and it is built and compiling.
>
> **Market.** Digital detox apps $498M → $1.38B by 2032. The beachhead is
> narrower and reachable without paid acquisition: people who already paid for a
> blocker and relapsed anyway — they say so in competitor app reviews.
>
> **Model.** The penalties are the revenue. Beeminder has run on exactly this
> for fifteen years, deliberately pledge-funded rather than subscription-funded
> so nobody is priced out. Ours is gentler: 80% is walkable back, theirs is not.
>
> **Status — honest.** Built solo in five weeks: Next.js/Postgres backend with
> the full Stripe hold-and-capture lifecycle, plus a Kotlin/Compose Android
> companion doing Play-compliant detection. Tests and CI green.
> **Zero users. No charge has moved yet.** First live loop is the next
> milestone, and it is what a programme's first month should close.
>
> **Founder.** MSc Applied Experimental Psychological Sciences (Milano-Bicocca);
> thesis was a within-subjects study, N=96, three conditions, RM-ANOVA,
> Holm-corrected, p=.009. Every competitor in this category makes a
> correlational claim. I can run the randomised trial.
>
> **The ask.** Programme + pre-seed → EU consumer-law review, a 30–50 user alpha
> on real cards at small stakes, part-time Android help on detection accuracy,
> and the causal study.

File name: `Costly-OnePager-SinaDehesh.pdf`

---

## 3. Antler's written answers

Their form asks about **you**, not the company. The questions they are known to
use, and where your material already answers them:

**"What are you passionate about, and how do you keep building in it?"**
The honest through-line: compulsive behaviour and whether interventions against
it actually work. BSc thesis on attributional style in methamphetamine
rehabilitation, 200 clinical interviews, MSc thesis on whether feedback changes
behaviour, and now a product built on that finding. Not a pivot — a decade on
one question.

**"Tell me about a time you circumvented a system to achieve an outcome."**
Strongest true answer: the detection engine. Play policy restricts
AccessibilityService to accessibility uses, which closes the obvious route to
knowing what app is in the foreground. Rather than abandon it or misuse the
API, you built a multi-signal engine — UsageStats, network draw, gyroscope
rhythm — that gets there compliantly. Constraint respected, outcome achieved.

**"Have you taken on sustained risk, and what came of it?"**
Answer honestly about scale. Daily Sublime is the cleanest evidence of sustained
effort with no guaranteed payoff: 30 issues, on schedule, over six months.

**"Are you available full time?"**
They ask, and it is a gate. Have the real answer ready.

Keep each to 150–200 words. Concrete beats adjectival — the numbers are your
advantage, so use them instead of describing yourself as driven.

---

## 4. The video (if asked, 60–90 seconds)

1. **0–10s** Who you are, one line.
2. **10–35s** The mechanic, out loud: money at stake, walk it back. Show the
   phone if you can — the live meter over Instagram is the whole pitch.
3. **35–55s** Why you: the thesis, in one sentence.
4. **55–75s** Status, honestly, including no users yet.
5. **75–90s** What you want from the programme.

Film it once badly and once more. Do not script it word for word — they are
watching how you talk, not what you wrote.

---

## 5. The packet, by programme

**Antler:** form + `Sina-Dehesh-CV.pdf` + written answers + video if prompted.
Do not attach the deck unless they ask. Sending an unrequested deck to a
day-zero programme signals you have misread what they select for.

**Techstars / Seedcamp / similar:** form + `Costly-Deck-2026-07.pdf` +
one-pager. Deck is `02-deck.md` rendered.

**Cold email to an investor:** five sentences — what it is, the loop, the
status (honest), the founder line, the ask — with the one-pager attached.
Never lead with the deck.

---

## Before you send anything

- [ ] CV's Costly entry updated to describe the v2 system
- [ ] One-pager fits on ONE page
- [ ] The `[NEEDS SOURCE]` bottom-up market number in `01-narrative.md` §9 is
      either sourced or cut — do not ship a placeholder
- [ ] The zero-users line survives every edit. It is the sentence that makes
      the rest of the document believable
- [ ] Read `03-qa-prep.md` aloud once. The written material only gets you to
      the interview, and the interview is the part that decides it
