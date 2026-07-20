'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CatWidget } from '@/components/CatWidget';
import { euros, eurosExact } from '@/lib/format';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const WISH_HINTS = ['PlayStation 5', 'AirPods', 'A nice dinner', 'A hardcover book', 'Concert tickets'];

interface WishDraft {
  name: string;
  priceEuros: string;
}

const inputClass =
  'w-full rounded-xl border-4 border-gray-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500';
const cardClass = 'rounded-xl border-4 border-gray-800 bg-black p-5';
const ctaClass =
  'w-full rounded-xl border-4 border-gray-800 bg-emerald-500 px-6 py-4 font-extrabold text-zinc-950 transition enabled:hover:brightness-110 disabled:opacity-30';
const backClass = 'rounded-xl border-4 border-gray-800 bg-zinc-900 px-6 py-4 font-bold text-zinc-400';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [email, setEmail] = useState('');
  const [hourlyEuros, setHourlyEuros] = useState('');
  // Step 2 — COMPLETELY OPTIONAL. Blank rows are a supported, first-class state.
  const [wishes, setWishes] = useState<WishDraft[]>(
    WISH_HINTS.map(() => ({ name: '', priceEuros: '' })),
  );
  // Step 3
  const [lockinDays, setLockinDays] = useState<7 | 30>(7);
  const [feeEuros, setFeeEuros] = useState(100);
  // Step 4
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const hourlyCents = Math.round(Number(hourlyEuros || 0) * 100);
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

  async function submitAndVault() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          hourlyRateCents: hourlyCents,
          anchorItems: filledWishes, // may legitimately be []
          deletionFeeCents: Math.round(feeEuros * 100),
          lockinDays,
          termsVersion: '2026-07-v2-arcade',
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'onboarding_failed');
      const { userId: newUserId } = await res.json();

      const siRes = await fetch('/api/stripe/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newUserId }),
      });
      if (!siRes.ok) throw new Error('setup_intent_failed');
      const { clientSecret: secret } = await siRes.json();

      window.localStorage.setItem('costly:userId', newUserId);
      setUserId(newUserId);
      setClientSecret(secret);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something failed. It was not us.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-zinc-950 px-4 py-8 sm:px-6">
      {/* Terminal header + progress */}
      <header className="rounded-xl border-4 border-gray-800 bg-black px-4 py-3">
        <p className="font-mono text-xs tracking-[0.25em] text-emerald-400">
          COSTLY://ONBOARDING · STEP {step}/4
        </p>
        <div className="mt-3 flex gap-1.5">
          {[1, 2, 3, 4].map((s) => (
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

      {step === 1 && (
        <section className="mt-6 space-y-5">
          <CatWidget penaltyCents={0} className="-rotate-1" />
          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">
              What is one hour of your life worth?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Be honest. A cheap rate makes a painless meter, and a painless
              meter changes nothing. The cat prefers you lie — it eats either
              way.
            </p>
            <label className="mt-4 block">
              <span className="font-mono text-[10px] tracking-widest text-zinc-500">EMAIL</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`${inputClass} mt-1`}
              />
            </label>
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
          <button
            disabled={!email.includes('@') || hourlyCents <= 0}
            onClick={() => setStep(2)}
            className={ctaClass}
          >
            CONTINUE
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="mt-6 space-y-5">
          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">
              What are you saving for? <span className="text-zinc-500">(optional)</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Name up to 5 things you actually want. If you do, the cat will
              taunt you with them by name when you burn money. If you skip
              this, it will simply brag about the garbage it bought instead.
              Both are valid lives.
            </p>
            <div className="mt-4 space-y-3">
              {wishes.map((w, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={w.name}
                    onChange={(e) =>
                      setWishes(wishes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder={WISH_HINTS[i]}
                    className={`${inputClass} flex-1`}
                  />
                  <input
                    type="number"
                    min="1"
                    value={w.priceEuros}
                    onChange={(e) =>
                      setWishes(
                        wishes.map((x, j) => (j === i ? { ...x, priceEuros: e.target.value } : x)),
                      )
                    }
                    placeholder="€"
                    className={`${inputClass} w-24 font-mono tabular-nums`}
                  />
                </div>
              ))}
            </div>
            {halfFilled && (
              <p className="mt-3 font-mono text-xs text-red-500">
                ERR: a wish needs both a name and a price. Or neither. Pick one.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className={backClass}>
              BACK
            </button>
            <button
              disabled={halfFilled}
              onClick={() => setStep(3)}
              className={`${ctaClass} flex-1`}
            >
              {filledWishes.length > 0 ? `LOCK IN ${filledWishes.length} HOSTAGE${filledWishes.length > 1 ? 'S' : ''}` : 'SKIP — NOTHING IS SACRED'}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-6 space-y-5">
          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">The Contract</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              The day this starts working, you will want to delete it. Decide
              now — while you still mean it — what running away costs.
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
                <p className="text-sm font-bold text-yellow-400">€0 — Not Recommended.</p>
                <p className="mt-1 text-xs text-yellow-400/80">
                  A contract with no teeth is a suggestion, and you have ignored
                  a decade of suggestions. Allowed. Not respected.
                </p>
              </div>
            )}

            <div className="mt-5 rounded-lg border-2 border-gray-800 bg-zinc-950 p-4">
              <p className="font-mono text-[10px] tracking-widest text-emerald-400">
                TERMS · 2026-07-v2-arcade
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs leading-relaxed text-zinc-400">
                <li>&gt; scroll: {eurosExact(perMinuteCents)}/min · 20% kept · 80% walkable 2:1, 24h</li>
                <li>&gt; lock-in: {lockinDays === 7 ? '1 week' : '1 month'} from today</li>
                <li>&gt; desertion: {euros(feeEuros * 100)}, charged off-session</li>
                <li>
                  &gt; hostages: {filledWishes.length > 0 ? `${filledWishes.length} named` : 'none — pure taunts'}
                </li>
              </ul>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className={backClass}>
              BACK
            </button>
            <button
              disabled={busy}
              onClick={submitAndVault}
              className="flex-1 rounded-xl border-4 border-gray-800 bg-red-500 px-6 py-4 font-extrabold text-zinc-950 transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'FILING…' : 'SIGN IT'}
            </button>
          </div>
        </section>
      )}

      {step === 4 && clientSecret && userId && (
        <section className="mt-6 space-y-5">
          <div className={cardClass}>
            <h1 className="text-2xl font-extrabold text-white">The Vault</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              We are not charging you today. We are making sure we{' '}
              <em>can</em> — while you scroll, while you sleep, while you
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
                <VaultCardForm userId={userId} onDone={() => router.push('/dashboard')} />
              </Elements>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function VaultCardForm({ userId, onDone }: { userId: string; onDone: () => void }) {
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
      body: JSON.stringify({ userId, setupIntentId: setupIntent?.id }),
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
