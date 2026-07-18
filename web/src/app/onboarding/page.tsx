'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { euros, eurosExact } from '@/lib/format';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const TIER_SUGGESTIONS = [
  { hint: 'A good coffee', price: 5 },
  { hint: 'A hardcover book', price: 25 },
  { hint: 'A nice dinner', price: 80 },
  { hint: 'AirPods', price: 250 },
  { hint: 'A PS5', price: 500 },
];

interface AnchorDraft {
  name: string;
  priceEuros: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [email, setEmail] = useState('');
  const [hourlyEuros, setHourlyEuros] = useState('');
  // Step 2
  const [anchors, setAnchors] = useState<AnchorDraft[]>(
    TIER_SUGGESTIONS.map(() => ({ name: '', priceEuros: '' })),
  );
  // Step 3
  const [lockinDays, setLockinDays] = useState<7 | 30>(7);
  const [feeEuros, setFeeEuros] = useState(100);
  // Step 4
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const hourlyCents = Math.round(Number(hourlyEuros || 0) * 100);
  const perMinuteCents = Math.max(1, Math.round(hourlyCents / 60));

  const anchorErrors = useMemo(() => {
    const errs: string[] = [];
    let prev = 0;
    anchors.forEach((a, i) => {
      const cents = Math.round(Number(a.priceEuros || 0) * 100);
      if (!a.name.trim() || cents <= 0) errs.push(`Tier ${i + 1} needs a name and a price.`);
      else if (cents <= prev) errs.push(`Tier ${i + 1} must cost more than tier ${i}.`);
      prev = cents;
    });
    return errs;
  }, [anchors]);

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
          anchorItems: anchors.map((a) => ({
            name: a.name.trim(),
            priceCents: Math.round(Number(a.priceEuros) * 100),
          })),
          deletionFeeCents: Math.round(feeEuros * 100),
          lockinDays,
          termsVersion: '2026-07-v1',
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
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <header className="mb-8">
        <p className="money text-xs tracking-[0.3em] text-accent">COSTLY / ONBOARDING</p>
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${s <= step ? 'bg-accent' : 'bg-surface'}`}
            />
          ))}
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-card border border-burn/40 bg-burn/10 p-4 text-sm text-burn">
          {error}
        </div>
      )}

      {step === 1 && (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">What is one hour of your life worth?</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Don&apos;t flatter yourself. Don&apos;t undersell yourself either — a cheap
              rate makes for a painless meter, and a painless meter changes
              nothing. Be honest. We&apos;ll do the math.
            </p>
          </div>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted">Your email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-card border border-surface bg-surface px-4 py-3 outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted">Hourly rate (€)</span>
            <input
              type="number"
              min="1"
              value={hourlyEuros}
              onChange={(e) => setHourlyEuros(e.target.value)}
              placeholder="30"
              className="money mt-1 w-full rounded-card border border-surface bg-surface px-4 py-3 text-2xl outline-none focus:border-accent"
            />
          </label>
          {hourlyCents > 0 && (
            <div className="rounded-card bg-surface p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Your scroll price</p>
              <p className="money mt-1 text-3xl text-burn">{eurosExact(perMinuteCents)}/min</p>
              <p className="mt-2 text-xs text-muted">
                Every minute in a vice app now costs exactly one minute of your
                working life. Seems fair. It is.
              </p>
            </div>
          )}
          <button
            disabled={!email.includes('@') || hourlyCents <= 0}
            onClick={() => setStep(2)}
            className="w-full rounded-card bg-accent px-6 py-4 font-semibold text-bg transition enabled:hover:brightness-110 disabled:opacity-30"
          >
            Continue
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">The Hostage Ladder</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Five things you actually want, cheapest to dearest. When your
              meter crosses one of their prices, we will let you know exactly
              what you just bought us instead of yourself.
            </p>
          </div>
          {anchors.map((a, i) => (
            <div key={i} className="rounded-card bg-surface p-4">
              <p className="money mb-2 text-xs text-muted">
                TIER {i + 1} · e.g. {TIER_SUGGESTIONS[i].hint} (~€{TIER_SUGGESTIONS[i].price})
              </p>
              <div className="flex gap-3">
                <input
                  value={a.name}
                  onChange={(e) =>
                    setAnchors(anchors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder={TIER_SUGGESTIONS[i].hint}
                  className="flex-1 rounded-lg border border-bg bg-bg px-3 py-2 outline-none focus:border-accent"
                />
                <input
                  type="number"
                  min="1"
                  value={a.priceEuros}
                  onChange={(e) =>
                    setAnchors(
                      anchors.map((x, j) => (j === i ? { ...x, priceEuros: e.target.value } : x)),
                    )
                  }
                  placeholder={String(TIER_SUGGESTIONS[i].price)}
                  className="money w-24 rounded-lg border border-bg bg-bg px-3 py-2 outline-none focus:border-accent"
                />
              </div>
            </div>
          ))}
          {anchorErrors.length > 0 && (
            <p className="text-xs text-muted">{anchorErrors[0]}</p>
          )}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="rounded-card bg-surface px-6 py-4 text-muted">
              Back
            </button>
            <button
              disabled={anchorErrors.length > 0}
              onClick={() => setStep(3)}
              className="flex-1 rounded-card bg-accent px-6 py-4 font-semibold text-bg transition enabled:hover:brightness-110 disabled:opacity-30"
            >
              Lock them in
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">The Contract</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Here is what you already know: the day this starts working,
              you will want to delete it. So decide now — while you still mean
              it — what running away costs.
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Lock-in period</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setLockinDays(d)}
                  className={`rounded-card border px-4 py-4 font-semibold transition ${
                    lockinDays === d
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-surface bg-surface text-muted'
                  }`}
                >
                  {d === 7 ? '1 week' : '1 month'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-xs uppercase tracking-wider text-muted">Deletion fee</p>
              <p className="money text-2xl text-burn">{euros(feeEuros * 100)}</p>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="5"
              value={feeEuros}
              onChange={(e) => setFeeEuros(Number(e.target.value))}
              className="mt-3 w-full accent-[#FF3B2F]"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Delete the app or strip its permissions before your lock-in ends
              and we charge this. Automatically. No call, no email thread, no
              &quot;are you sure&quot;. You are signing the &quot;are you sure&quot; right now.
            </p>
            {feeEuros === 0 && (
              <div className="mt-3 rounded-card border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
                <p className="font-semibold">€0 — Not Recommended.</p>
                <p className="mt-1 text-gold/80">
                  A contract with no teeth is a suggestion, and you have already
                  ignored a decade of suggestions. But it&apos;s your funeral.
                  We&apos;ll allow it.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-card bg-surface p-4 text-sm leading-relaxed">
            <p className="money mb-2 text-xs tracking-widest text-accent">TERMS · 2026-07-v1</p>
            <ul className="space-y-1 text-muted">
              <li>· Scrolling: {eurosExact(perMinuteCents)}/min, 20% kept, 80% walkable (2:1, 24h).</li>
              <li>· Lock-in: {lockinDays === 7 ? '1 week' : '1 month'} from today.</li>
              <li>· Desertion during lock-in: {euros(feeEuros * 100)}, charged off-session.</li>
              <li>· After lock-in: cancel free, or renew. Your choice, made honestly.</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="rounded-card bg-surface px-6 py-4 text-muted">
              Back
            </button>
            <button
              disabled={busy}
              onClick={submitAndVault}
              className="flex-1 rounded-card bg-burn px-6 py-4 font-semibold text-bg transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Filing the paperwork…' : 'Sign it'}
            </button>
          </div>
        </section>
      )}

      {step === 4 && clientSecret && userId && (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">The Vault</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              We are not charging you today. We are making sure we{' '}
              <em>can</em> — while you scroll, while you sleep, while you
              pretend this app doesn&apos;t exist. Card goes in, contract goes
              live.
            </p>
          </div>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#2EDB6A',
                  colorBackground: '#151812',
                  colorText: '#F2F4EF',
                  borderRadius: '12px',
                },
              },
            }}
          >
            <VaultCardForm userId={userId} onDone={() => router.push('/dashboard')} />
          </Elements>
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
    <div className="space-y-6">
      <PaymentElement />
      {error && <p className="text-sm text-burn">{error}</p>}
      <button
        disabled={busy || !stripe}
        onClick={vault}
        className="w-full rounded-card bg-accent px-6 py-4 font-semibold text-bg transition enabled:hover:brightness-110 disabled:opacity-50"
      >
        {busy ? 'Vaulting…' : 'Arm the meter'}
      </button>
      <p className="text-center text-xs text-muted">
        Stored by Stripe, not by us. Charged by us, not by Stripe&apos;s
        conscience.
      </p>
    </div>
  );
}
