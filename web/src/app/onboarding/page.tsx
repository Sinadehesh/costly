'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CatWidget } from '@/components/CatWidget';
import { GoogleSignIn } from '@/components/GoogleSignIn';
import { euros, eurosExact } from '@/lib/format';
import { DAILY_FREE_MINUTE_OPTIONS } from '@/lib/penalty';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const WISH_HINTS = ['PlayStation 5', 'AirPods', 'A nice dinner', 'A hardcover book', 'Concert tickets'];

/**
 * Pickable wishes with a typical price. Choosing one fills in BOTH the name
 * and the price, so a working hostage ladder takes five taps and no typing —
 * the field used to be two blank boxes per row, which is why nobody filled it
 * in. Prices stay editable after picking, and "Something else…" keeps the
 * free-text path for anything not on the list.
 */
interface WishOption {
  name: string;
  priceEuros: number;
}

const CUSTOM = '__custom__';

/** General ToS version stamped on the contract. */
const TERMS_VERSION = '2026-07-v2-arcade';

/**
 * Version of the withdrawal-right consent wording specifically. Tracked apart
 * from TERMS_VERSION because the statutory exception depends on THIS text
 * having been shown and agreed to — bump it whenever the wording changes, and
 * never reuse a version for different words.
 */
const WITHDRAWAL_TERMS_VERSION = '2026-07-withdrawal-v1';

const WISH_CATALOGUE: { group: string; items: WishOption[] }[] = [
  {
    group: 'Small stuff (€5€30)',
    items: [
      { name: 'A fancy coffee', priceEuros: 5 },
      { name: 'A cinema ticket', priceEuros: 13 },
      { name: 'Lunch out', priceEuros: 15 },
      { name: 'A hardcover book', priceEuros: 25 },
      { name: 'A month of streaming', priceEuros: 30 },
    ],
  },
  {
    group: 'Nights out (€50€150)',
    items: [
      { name: 'A nice dinner', priceEuros: 80 },
      { name: 'Concert tickets', priceEuros: 90 },
      { name: 'A month at the gym', priceEuros: 50 },
      { name: 'A good pair of jeans', priceEuros: 120 },
      { name: 'A weekend train trip', priceEuros: 150 },
    ],
  },
  {
    group: 'Real money (€200€600)',
    items: [
      { name: 'AirPods', priceEuros: 250 },
      { name: 'A mechanical keyboard', priceEuros: 200 },
      { name: 'A PlayStation 5', priceEuros: 500 },
      { name: 'A flight home', priceEuros: 400 },
      { name: 'A new phone', priceEuros: 600 },
    ],
  },
  {
    group: 'The big ones (€1000+)',
    items: [
      { name: 'A laptop', priceEuros: 1200 },
      { name: 'A holiday abroad', priceEuros: 1500 },
      { name: 'A used car', priceEuros: 4000 },
      { name: 'Rent for a month', priceEuros: 1000 },
    ],
  },
];

const ALL_WISH_NAMES = WISH_CATALOGUE.flatMap((g) => g.items.map((i) => i.name));

interface WishDraft {
  name: string;
  priceEuros: string;
  /** True once the user picks "Something else…" — reveals the text input. */
  custom: boolean;
}

const inputClass =
  'w-full rounded-xl border-4 border-gray-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500';
const cardClass = 'rounded-xl border-4 border-gray-800 bg-black p-5';
const ctaClass =
  'w-full rounded-xl border-4 border-gray-800 bg-emerald-500 px-6 py-4 font-extrabold text-zinc-950 transition enabled:hover:brightness-110 disabled:opacity-30';
const backClass = 'rounded-xl border-4 border-gray-800 bg-zinc-900 px-6 py-4 font-bold text-zinc-400';

/**
 * The mechanic, in the cat's own voice, one beat per tap. Each beat carries the
 * cat state it should be wearing while it says the line, so the mascot gets
 * visibly greedier as the deal gets worse — the explanation and the warning
 * are the same object.
 */
const BEATS: { line: string; cents: number; walkingPct?: number }[] = [
  { line: 'You tell me what one hour of your life is worth.', cents: 0 },
  {
    line: 'Open Instagram and I start charging that rate to your card. By the minute.',
    cents: 60,
  },
  {
    line: 'When you close it, 20% is mine. Permanently. That part never comes back. neither did the time.',
    cents: 640,
  },
  {
    line: 'The other 80% I only hold for 24 hours. Walk two minutes for every minute you scrolled and you get all of it back.',
    cents: 3200,
    walkingPct: 100,
  },
  { line: "Don't walk, and I keep that too.", cents: 2400 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1 — the explainer. `beat` is how far through the cat's account of
  // the mechanic the user has tapped; the continue button stays dead until
  // they reach the end AND tick the box.
  const [beat, setBeat] = useState(0);
  const [moneyUnderstood, setMoneyUnderstood] = useState(false);

  // Step 2. Current usage is asked FIRST: nine interviews all opened with
  // "how much do you use Instagram" and every single person answered in a
  // second, so it is free input — and it makes the rate question mean
  // something instead of arriving cold.
  const [usageHours, setUsageHours] = useState<number | null>(null);
  // Step 2
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hourlyEuros, setHourlyEuros] = useState('');
  const [dailyFreeMinutes, setDailyFreeMinutes] = useState(0);
  // Step 2 — COMPLETELY OPTIONAL. Blank rows are a supported, first-class state.
  const [wishes, setWishes] = useState<WishDraft[]>(
    WISH_HINTS.map(() => ({ name: '', priceEuros: '', custom: false })),
  );
  // Step 3
  const [lockinDays, setLockinDays] = useState<7 | 30>(7);
  const [feeEuros, setFeeEuros] = useState(100);
  // Must be an explicit, un-prechecked action — a pre-ticked box is not
  // express consent, and this one is the reason the charges stand up.
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  // Step 5 — Google is the default; this reveals the email alternative.
  const [emailFallback, setEmailFallback] = useState(false);
  // Step 4
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const hourlyCents = Math.round(Number(hourlyEuros || 0) * 100);
  // Time cost of the CURRENT habit, in the two horizons a tester asked for:
  // "on this rate you will waste 50 hours this year, or 2 years of your life".
  const daysPerYear = usageHours ? Math.round((usageHours * 365) / 24) : 0;
  const yearsPerDecade = usageHours ? (usageHours * 3650) / 24 / 365 : 0;
  const perMinuteCents = Math.max(1, Math.round(hourlyCents / 60));

  // A row counts only when BOTH fields are filled; a half-filled row is the
  // one thing we refuse (we won't guess what "PlayStation, €" costs).
  const filledWishes = useMemo(
    () =>
      wishes
        .filter((w) => w.name.trim() !== '' && Number(w.priceEuros) > 0)
        .map((w) => ({ name: w.name.trim(), priceCents: Math.round(Number(w.priceEuros) * 100) })),
    [wishes],
  );
  const halfFilled = useMemo(
    () =>
      wishes.some(
        (w) =>
          (w.name.trim() === '') !== (w.priceEuros.trim() === '') ||
          (w.priceEuros.trim() !== '' && !(Number(w.priceEuros) > 0)),
      ),
    [wishes],
  );

  /**
   * Read a failed response without letting the read itself blow up. A 500 from
   * an unhandled throw comes back as HTML, so `res.json()` raises a syntax
   * error and the user is shown *that* instead of what actually went wrong —
   * which is how a missing env var or an unapplied migration ends up looking
   * like a frontend bug.
   */
  async function failureMessage(res: Response, fallback: string): Promise<string> {
    const raw = await res.text().catch(() => '');
    try {
      const body = JSON.parse(raw);
      return body.message ?? body.error ?? `${fallback} (HTTP ${res.status})`;
    } catch {
      const snippet = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      return snippet
        ? `${fallback} (HTTP ${res.status}). ${snippet}`
        : `${fallback} (HTTP ${res.status})`;
    }
  }

  /**
   * Save the contract terms and fetch a SetupIntent, then show the card step.
   * Runs only after sign-in, so /api/onboarding authenticates by cookie and
   * never has to be told which account these terms belong to.
   */
  async function saveContractAndVault() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hourlyRateCents: hourlyCents,
          dailyFreeMinutes,
          anchorItems: filledWishes, // may legitimately be []
          deletionFeeCents: Math.round(feeEuros * 100),
          lockinDays,
          termsVersion: TERMS_VERSION,
          withdrawalConsent,
          withdrawalTermsVersion: WITHDRAWAL_TERMS_VERSION,
        }),
      });
      if (!res.ok) throw new Error(await failureMessage(res, 'Could not save your contract'));

      const siRes = await fetch('/api/stripe/setup-intent', { method: 'POST' });
      if (!siRes.ok) throw new Error(await failureMessage(siRes, 'Could not reach Stripe'));
      const { clientSecret: secret } = await siRes.json();

      setClientSecret(secret);
      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something failed. It was not us.');
    } finally {
      setBusy(false);
    }
  }

  /** Google: one tap, no password to invent, no page to visit. */
  async function signInWithGoogle(idToken: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error(await failureMessage(res, 'Google sign-in failed'));
      const body = await res.json();
      window.localStorage.setItem('costly:userId', body.userId);
      setUserId(body.userId);
      await saveContractAndVault();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
      setBusy(false);
    }
  }

  /** The opt-in alternative for people who would rather not use Google. */
  async function signUpWithPassword() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await failureMessage(res, 'Could not create your account'));
      const body = await res.json();
      window.localStorage.setItem('costly:userId', body.userId);
      setUserId(body.userId);
      await saveContractAndVault();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account.');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-zinc-950 px-4 py-8 sm:px-6">
      {/* Terminal header + progress */}
      <header className="rounded-xl border-4 border-gray-800 bg-black px-4 py-3">
        <p className="font-mono text-xs tracking-[0.25em] text-emerald-400">
          COSTLY://ONBOARDING · STEP {step}/6
        </p>
        <div className="mt-3 flex gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded ${s <= step ? 'bg-emerald-500' : 'bg-zinc-800'}`}
            />
          ))}
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border-4 border-red-900 bg-black p-4 font-mono text-sm text-red-500">
          ERR: {error}
        </div>
      )}

      {/* ── Step 1 · HOW THIS WORKS ────────────────────────────────────────
          Two testers in a row proved this screen had to exist. One didn't
          understand the product until she was asked to read the text; another
          said it outright: "some people could mistake it and think this money
          is not real money and get fucked. make it very clear that it's your
          real money and your credit card."

          So it is revealed one beat at a time and gated on a tap. You cannot
          skim past a sentence that hasn't rendered yet, which is the only
          layout trick that reliably makes someone read. The cat gets hungrier
          as it explains, so the thing holding your attention is also the thing
          delivering the warning. */}
      {step === 1 && (
        <section className="mt-6 space-y-5">
          <CatWidget
            penaltyCents={BEATS[beat].cents}
            walkingPct={BEATS[beat].walkingPct}
            wishlistItem="PlayStation"
          />

          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">How this works</h1>

            <ol className="mt-4 space-y-3">
              {BEATS.slice(0, beat + 1).map((b, i) => (
                <li key={b.line} className="flex gap-3">
                  <span className="font-mono text-sm text-emerald-500">{i + 1}</span>
                  <p className="text-[15px] leading-relaxed text-zinc-200">{b.line}</p>
                </li>
              ))}
            </ol>

            {beat < BEATS.length - 1 ? (
              <button
                onClick={() => setBeat((b) => b + 1)}
                className="mt-5 w-full rounded-xl border-4 border-gray-800 bg-zinc-900 px-6 py-3 font-bold text-emerald-400"
              >
                Go on…
              </button>
            ) : (
              <>
                {/* The sentence the whole screen exists for. */}
                <div className="mt-5 rounded-xl border-4 border-red-600 bg-red-950/30 p-4">
                  <p className="font-mono text-[10px] tracking-widest text-red-500">
                    THIS IS NOT A GAME
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed font-semibold text-white">
                    Real money. Your real credit card. Costly charges it
                    automatically, without asking again, every time you scroll.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    Nobody is pretending. If that is not what you want, close
                    this page. that costs nothing, and it is a completely
                    reasonable thing to do.
                  </p>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={moneyUnderstood}
                    onChange={(e) => setMoneyUnderstood(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 accent-emerald-500"
                  />
                  <span className="text-sm leading-snug text-zinc-300">
                    I understand Costly will charge my real card with real money.
                  </span>
                </label>
              </>
            )}
          </div>

          <button
            disabled={beat < BEATS.length - 1 || !moneyUnderstood}
            onClick={() => setStep(2)}
            className={ctaClass}
          >
            {moneyUnderstood ? 'I UNDERSTAND. CONTINUE' : 'READ IT FIRST'}
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="mt-6 space-y-5">
          <CatWidget penaltyCents={0} className="-rotate-1" />

          {/* ── Current usage → the time cost ──────────────────────────────
              The most-validated element in the whole cohort. One tester asked
              for the yearly figure in red; another checked EVERY option just to
              compare the hours and said "I appreciate how much it is in the
              whole year, it teaches me so much". then asked for exactly this:
              a forward-looking number, "at this rate you will waste 50 hours
              this year, or 2 years of your life".

              Time is the headline, money is the footnote. She reacted to the
              hours, not the euros. and the euro figure here is the WORTH of
              that time at her own rate, not a bill we intend to send. Caps and
              the free allowance mean the two are not the same, and implying
              otherwise would be a lie the first statement would expose. */}
          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">
              How much do you scroll now?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Roughly. Your phone already knows. this is just so you can see it.
            </p>

            <div className="mt-4 grid grid-cols-6 gap-1.5">
              {[0.5, 1, 1.5, 2, 3, 4].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setUsageHours(h)}
                  className={`rounded-lg border-2 py-3 font-mono text-xs font-bold tabular-nums transition ${
                    usageHours === h
                      ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                      : 'border-gray-800 bg-zinc-950 text-zinc-400 hover:border-gray-700'
                  }`}
                >
                  {h === 4 ? '4h+' : h < 1 ? '30m' : `${h}h`}
                </button>
              ))}
            </div>
            <p className="mt-2 text-center font-mono text-[10px] tracking-widest text-zinc-600">
              PER DAY
            </p>

            {usageHours !== null && (
              <div className="mt-4 rounded-lg border-2 border-red-900 bg-red-950/20 p-4">
                <p className="font-mono text-[10px] tracking-widest text-red-500">
                  AT THIS RATE
                </p>
                <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-red-500">
                  {daysPerYear} days
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  of your life, this year. Awake, holding your phone.
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  Keep it up for a decade and that is{' '}
                  <strong className="font-mono text-white">
                    {yearsPerDecade.toFixed(1)} years
                  </strong>{' '}
                  gone.
                  {hourlyCents > 0 && (
                    <>
                      {' '}
                      At the rate you just set, that time is worth{' '}
                      <span className="font-mono text-white">
                        {euros(Math.round(usageHours * 365 * hourlyCents))}
                      </span>{' '}
                      a year to you.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">
              What is one hour of your life worth?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Be honest. A cheap rate makes a painless meter, and a painless
              meter changes nothing. The cat prefers you lie. it eats either
              way.
            </p>
            <label className="mt-4 block">
              <span className="font-mono text-[10px] tracking-widest text-zinc-500">
                HOURLY RATE (€)
              </span>
              <input
                type="number"
                min="1"
                value={hourlyEuros}
                onChange={(e) => setHourlyEuros(e.target.value)}
                placeholder="30"
                className={`${inputClass} mt-1 font-mono text-2xl tabular-nums`}
              />
            </label>
            {hourlyCents > 0 && (
              <div className="mt-4 rounded-lg border-2 border-gray-800 bg-zinc-950 p-4">
                <p className="font-mono text-[10px] tracking-widest text-zinc-500">
                  YOUR SCROLL PRICE
                </p>
                <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-emerald-400">
                  {eurosExact(perMinuteCents)}/min
                </p>
              </div>
            )}
          </div>

          {/* Daily free allowance. The honest warning comes first, in a plain
              voice. a health claim delivered entirely in sarcasm reads as a
              joke, and this one is not one. The cat gets the last word only. */}
          <div className={cardClass}>
            <h2 className="text-xl font-extrabold text-white">Free minutes each day</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Time the meter ignores. Resets daily, not per session.
            </p>

            {/* Short on purpose. the long version tested as a wall people
                skipped. It names the excuse instead of arguing with it: one
                tester doomscrolls "to calm down", and the reason is always
                real, which is exactly why the habit holds. */}
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Every habit like this comes with a good reason attached. the
              news, your friends&apos; stories, winding down. They&apos;re real.
              They all have another way in.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Pick <strong className="text-white">0</strong>, or{' '}
              <strong className="text-white">5</strong> for the stories. Locked
              for the whole contract. a limit you can raise on a bad evening is
              not a limit.
            </p>

            <div className="mt-4 grid grid-cols-5 gap-1.5">
              {DAILY_FREE_MINUTE_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDailyFreeMinutes(m)}
                  className={`rounded-lg border-2 py-3 font-mono text-sm font-bold tabular-nums transition ${
                    dailyFreeMinutes === m
                      ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                      : 'border-gray-800 bg-zinc-950 text-zinc-400 hover:border-gray-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-2 text-center font-mono text-[10px] tracking-widest text-zinc-600">
              MINUTES PER DAY · FREE
            </p>

            {/* A tester asked for exactly this, in exactly this colour: the
                yearly figure is the number that lands, because minutes a day
                sound free and hours a year do not. */}
            {dailyFreeMinutes === 0 ? (
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                Zero. Every second is billable from the moment you open it.
              </p>
            ) : (
              <div className="mt-4 rounded-lg border-2 border-red-900 bg-red-950/20 p-4">
                <p className="font-mono text-[10px] tracking-widest text-red-500">
                  WHAT YOU ARE AGREEING TO LOSE
                </p>
                <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-red-500">
                  {Math.round((dailyFreeMinutes * 365) / 60)} hours a year
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {dailyFreeMinutes} minutes every day, free of charge, forever.
                </p>
              </div>
            )}
          </div>

          <button
            disabled={hourlyCents <= 0 || usageHours === null}
            onClick={() => setStep(3)}
            className={ctaClass}
          >
            CONTINUE
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="mt-6 space-y-5">
          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">
              What are you saving for? <span className="text-zinc-500">(optional)</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Pick up to 5 things you actually want. prices are filled in for
              you and stay editable, and &ldquo;Something else…&rdquo; lets you
              name your own. If you do, the cat will taunt you with them by
              name when you burn money. If you skip this, it will simply brag
              about the garbage it bought instead. Both are valid lives.
            </p>
            <div className="mt-4 space-y-3">
              {wishes.map((w, i) => {
                // Don't offer a wish already taken by another row — five
                // identical hostages is not a ladder.
                const takenElsewhere = new Set(
                  wishes.filter((_, j) => j !== i).map((x) => (x.custom ? '' : x.name)),
                );
                const selectValue = w.custom ? CUSTOM : ALL_WISH_NAMES.includes(w.name) ? w.name : '';

                return (
                  <div key={i} className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={selectValue}
                        onChange={(e) => {
                          const picked = e.target.value;
                          setWishes(
                            wishes.map((x, j) => {
                              if (j !== i) return x;
                              if (picked === '') return { name: '', priceEuros: '', custom: false };
                              if (picked === CUSTOM)
                                return { name: '', priceEuros: '', custom: true };
                              const opt = WISH_CATALOGUE.flatMap((g) => g.items).find(
                                (o) => o.name === picked,
                              );
                              return {
                                name: picked,
                                priceEuros: opt ? String(opt.priceEuros) : '',
                                custom: false,
                              };
                            }),
                          );
                        }}
                        className={`${inputClass} flex-1 appearance-none`}
                      >
                        <option value=""> nothing in slot {i + 1} </option>
                        {WISH_CATALOGUE.map((group) => (
                          <optgroup key={group.group} label={group.group}>
                            {group.items.map((opt) => (
                              <option
                                key={opt.name}
                                value={opt.name}
                                disabled={takenElsewhere.has(opt.name)}
                              >
                                {opt.name}. €{opt.priceEuros}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <option value={CUSTOM}>Something else…</option>
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={w.priceEuros}
                        onChange={(e) =>
                          setWishes(
                            wishes.map((x, j) =>
                              j === i ? { ...x, priceEuros: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="€"
                        className={`${inputClass} w-24 font-mono tabular-nums`}
                      />
                    </div>
                    {w.custom && (
                      <input
                        value={w.name}
                        onChange={(e) =>
                          setWishes(
                            wishes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                          )
                        }
                        placeholder={WISH_HINTS[i]}
                        autoFocus
                        className={`${inputClass} w-full`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {halfFilled && (
              <p className="mt-3 font-mono text-xs text-red-500">
                ERR: a wish needs both a name and a price. Or neither. Pick one.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className={backClass}>
              BACK
            </button>
            <button
              disabled={halfFilled}
              onClick={() => setStep(4)}
              className={`${ctaClass} flex-1`}
            >
              {filledWishes.length > 0 ? `LOCK IN ${filledWishes.length} HOSTAGE${filledWishes.length > 1 ? 'S' : ''}` : 'SKIP. NOTHING IS SACRED'}
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="mt-6 space-y-5">
          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">The Contract</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              The day this starts working, you will want to delete it. Decide
              now. while you still mean it. what running away costs.
            </p>

            <p className="mt-4 font-mono text-[10px] tracking-widest text-zinc-500">LOCK-IN</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setLockinDays(d)}
                  className={`rounded-xl border-4 px-4 py-3 font-bold ${
                    lockinDays === d
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-gray-800 bg-zinc-950 text-zinc-500'
                  }`}
                >
                  {d === 7 ? '1 WEEK' : '1 MONTH'}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-baseline justify-between">
              <p className="font-mono text-[10px] tracking-widest text-zinc-500">DELETION FEE</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-red-500">
                {euros(feeEuros * 100)}
              </p>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="5"
              value={feeEuros}
              onChange={(e) => setFeeEuros(Number(e.target.value))}
              className="mt-2 w-full accent-red-500"
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Delete the app or strip its permissions before lock-in ends and
              this is charged. Automatically. You are signing the
              &quot;are you sure&quot; right now.
            </p>
            {feeEuros === 0 && (
              <div className="mt-3 rounded-lg border-2 border-yellow-500 bg-yellow-500/10 p-3">
                <p className="text-sm font-bold text-yellow-400">€0. Not Recommended.</p>
                <p className="mt-1 text-xs text-yellow-400/80">
                  A contract with no teeth is a suggestion, and you have ignored
                  a decade of suggestions. Allowed. Not respected.
                </p>
              </div>
            )}

            <div className="mt-5 rounded-lg border-2 border-gray-800 bg-zinc-950 p-4">
              <p className="font-mono text-[10px] tracking-widest text-emerald-400">
                TERMS · {TERMS_VERSION}
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs leading-relaxed text-zinc-400">
                <li>&gt; scroll: {eurosExact(perMinuteCents)}/min · 20% kept · 80% walkable 2:1, 24h</li>
                <li>&gt; lock-in: {lockinDays === 7 ? '1 week' : '1 month'} from today</li>
                <li>&gt; desertion: {euros(feeEuros * 100)}, charged off-session</li>
                <li>
                  &gt; hostages: {filledWishes.length > 0 ? `${filledWishes.length} named` : 'none. pure taunts'}
                </li>
              </ul>
            </div>

            {/* Express consent to immediate performance during the statutory
                14-day withdrawal period. Kept visually plain and legible 
                this one is not a joke, and burying it in arcade styling would
                undermine the very thing it exists to establish. */}
            <label className="mt-5 flex cursor-pointer gap-3 rounded-lg border-2 border-zinc-700 bg-zinc-950 p-4">
              <input
                type="checkbox"
                checked={withdrawalConsent}
                onChange={(e) => setWithdrawalConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
              />
              <span className="text-xs leading-relaxed text-zinc-300">
                I ask Costly to <strong className="text-white">start immediately</strong>, during
                the 14-day withdrawal period, and I understand that I{' '}
                <strong className="text-white">lose my right to withdraw</strong> once the service
                has been fully performed. Metering, charges and the deletion fee can therefore
                apply from today rather than after 14 days.
              </span>
            </label>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-zinc-600">
              consent · {WITHDRAWAL_TERMS_VERSION}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className={backClass}>
              BACK
            </button>
            <button
              disabled={!withdrawalConsent}
              onClick={() => setStep(5)}
              className="flex-1 rounded-xl border-4 border-gray-800 bg-red-500 px-6 py-4 font-extrabold text-zinc-950 transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              {withdrawalConsent ? 'SIGN IT' : 'TICK THE BOX FIRST'}
            </button>
          </div>
        </section>
      )}

      {/* ── Step 5 · SIGN IN ───────────────────────────────────────────────
          Deliberately the second-to-last step. Everything above is the user
          deciding what they want; an account is only needed at the point where
          we have something to attach a card to. Asking for credentials first
          makes people sign up before they know whether they want the product.

          Google is the default because it is one tap and invents no password.
          Email is offered underneath for anyone who would rather not hand
          Google another app, which is a reasonable thing to want. */}
      {step === 5 && (
        <section className="mt-6 space-y-5">
          <CatWidget penaltyCents={0} wishlistItem={filledWishes[0]?.name ?? null} />
          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">Save your contract</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Your terms are set. Sign in so they stick to an account, then add
              the card that makes them real.
            </p>

            <div className="mt-5">
              <GoogleSignIn onToken={signInWithGoogle} disabled={busy} />
            </div>

            {!emailFallback ? (
              <button
                type="button"
                onClick={() => setEmailFallback(true)}
                className="mt-4 w-full text-center text-sm text-zinc-500 underline"
              >
                Use an email and password instead
              </button>
            ) : (
              <div className="mt-5 border-t-2 border-gray-800 pt-5">
                <label className="block">
                  <span className="font-mono text-[10px] tracking-widest text-zinc-500">
                    EMAIL
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="font-mono text-[10px] tracking-widest text-zinc-500">
                    PASSWORD
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="at least 8 characters"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <button
                  disabled={busy || !email.includes('@') || password.length < 8}
                  onClick={signUpWithPassword}
                  className={`${ctaClass} mt-4`}
                >
                  {busy ? 'SAVING…' : 'CONTINUE'}
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(4)} className={backClass}>
              BACK
            </button>
          </div>
        </section>
      )}

      {step === 6 && clientSecret && userId && (
        <section className="mt-6 space-y-5">
          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">The Vault</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              We are not charging you today. We are making sure we{' '}
              <em>can</em>. while you scroll, while you sleep, while you
              pretend this app doesn&apos;t exist.
            </p>
            <div className="mt-4">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'night',
                    variables: {
                      colorPrimary: '#10B981',
                      colorBackground: '#09090B',
                      colorText: '#FFFFFF',
                      borderRadius: '12px',
                    },
                  },
                }}
              >
                <VaultCardForm onDone={() => router.push('/dashboard')} />
              </Elements>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function VaultCardForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vault() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    const { setupIntent, error: confirmError } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/dashboard` },
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Your bank said no. Try another card.');
      setBusy(false);
      return;
    }

    // The webhook is the canonical writer of the saved payment method, but
    // confirm server-side too so local dev (no webhook forwarding) still works.
    await fetch('/api/stripe/setup-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupIntentId: setupIntent?.id }),
    });

    onDone();
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <p className="font-mono text-sm text-red-500">ERR: {error}</p>}
      <button disabled={busy || !stripe} onClick={vault} className={ctaClass}>
        {busy ? 'VAULTING…' : 'ARM THE METER'}
      </button>
      <p className="text-center font-mono text-xs text-zinc-600">
        stored by Stripe, not by us. charged by us, not by Stripe&apos;s conscience.
      </p>
    </div>
  );
}
