# Accelerator pitch — working set

Pitch materials for Costly, prepared for accelerator applications and
partner meetings. Founder: **Sina Dehesh** (Milan).

| File | What it is | Use it for |
| --- | --- | --- |
| `01-narrative.md` | The full written pitch — problem through the ask | Written applications (YC-style forms), the memo you send before a call |
| `02-deck.md` | 13-slide deck, slide by slide, with speaker notes | The 8-minute pitch; hand to a designer or render as slides |
| `03-qa-prep.md` | The hostile questions and the answers | Prep before any partner call — read this last, out loud |

## Three rules these documents follow

1. **No invented traction.** Costly has zero users and has never moved a
   real charge. Every document says so plainly. Accelerator diligence
   catches inflated numbers, and at pre-seed the thing being funded is
   founder velocity plus insight — not metrics. Padding here trades a
   strength for a liability.
2. **Market figures are cited, or marked.** Third-party market sizes carry
   their source inline. Anything not yet sourced is tagged
   `[NEEDS SOURCE]` — do not read those aloud until they are real.
3. **The founder voice is not the villain voice.** Costly talks like a
   sarcastic loan shark; that is the product's craft and worth *quoting*
   as evidence. The pitch itself is plain, confident, and slightly dry.
   A founder who performs the bit for eight minutes reads as a person
   who can't step outside their own product.

## The business model is settled: penalties are the revenue

`01-narrative.md` §7 argues this position rather than hedging it, because
it is precedented. Beeminder has charged users on failure and kept the
money for fifteen years, deliberately pledge-funded instead of
subscription-funded so nobody gets priced out; StepBet and DietBet rake
10–25% of a forfeit pot. Costly's version is gentler than any of them —
80% of every penalty is walkable back inside 24 hours.

Three reasons this is right for Costly and not merely defensible: the
villain persona needs a real stake or the whole antagonist premise
collapses; keeping penalties as revenue avoids taking custody of user
funds, which is what would trigger EU e-money questions; and
penalty-funding lets the product be free to start.

**The risk that remains is detection accuracy.** Costly is a deposit
contract with clocks, same as the precedent — every session's 80% sits
under a visible 24-hour countdown, and the contract runs a fixed 7 or 30
days the user chose. Costly holds no money at any point: Stripe holds the
80% as an authorization on the user's own card, and we cancel or capture.

**The 20% burn is permanent on purpose** (§7) — a loss that can be fully
undone was never a loss, and the forty minutes don't come back either. Do
not present it as a rough edge to be smoothed; a grace window on the burn
would neuter the mechanic. The real exposure is that a *wrongly detected*
session burns money that cannot be returned, which is why threshold tuning
is the first line item in the ask, backed by a manual false-positive refund
policy that is support practice rather than an advertised product path.

## Still open before submitting

- **EU unfair-terms review of the breach fee** (§10). Ordinary ground when
  framed correctly: the user sets the amount and signs a fixed term, so
  uninstalling is an early breach — the shape of a phone-plan termination
  fee.
- **The withdrawal-right question** (§10). Onboarding takes express consent
  to immediate performance plus the acknowledgement, which is the right
  statutory mechanism. The open question is whether an *ongoing* 7-day
  monitoring term counts as "fully performed" for that exception; if not, a
  mid-term withdrawal may reduce recovery to pro-rata. May argue for a
  30-day default.
- **The bottom-up market estimate** (§9), currently tagged
  `[NEEDS SOURCE]`.

## Also worth fixing

Your CV's Costly bullet still describes the v1 build — "an Android app
that converts time spent in distraction apps into a live monetary burn
rate anchored to a personal savings goal." The current system is a web
app plus an Android companion, with real Stripe holds and a walking
redemption loop. Suggested replacement in `03-founder-cv-note` at the
bottom of `01-narrative.md`. Reviewers read the CV and the pitch side by
side; a mismatch reads as staleness rather than progress.
