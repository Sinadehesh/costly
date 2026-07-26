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

## Open decisions before this pitch is submittable

Two things in `01-narrative.md` are recommendations, not settled facts.
Decide them before you send anything:

- **The business model** (§7). The build currently routes penalties to
  the company. The recommended pitch position routes them into the
  user's own savings pot instead, with subscription as revenue. This is a
  product decision with real code behind it, and partners will attack the
  current version within two minutes.
- **The legal position** (§10). Holding user money in escrow may trigger
  EU e-money/payment-institution rules. Today's Stripe-hold design avoids
  custody. Get an actual opinion before promising escrow on a slide.

## Also worth fixing

Your CV's Costly bullet still describes the v1 build — "an Android app
that converts time spent in distraction apps into a live monetary burn
rate anchored to a personal savings goal." The current system is a web
app plus an Android companion, with real Stripe holds and a walking
redemption loop. Suggested replacement in `03-founder-cv-note` at the
bottom of `01-narrative.md`. Reviewers read the CV and the pitch side by
side; a mismatch reads as staleness rather than progress.
