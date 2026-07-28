'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CatWidget } from '@/components/CatWidget';
import { Odometer } from '@/components/Odometer';
import { appName, euros, eurosExact, timeLeft } from '@/lib/format';

/**
 * THE TERMINAL. Redesign notes, because the changes are opinionated:
 *
 * 1. HIERARCHY. Every section used to be the same card at the same weight —
 *    lifetime losses, the contract, the wishlist, all shouting equally, which
 *    means none of them shouted. There is now one hero, and it is the money
 *    still SAVEABLE, not the money already gone. Leading with the recoverable
 *    number is the difference between a dashboard that makes you feel bad and
 *    one that makes you go outside; the sunk total moves to a stat strip.
 *
 * 2. VICTORY EXISTS NOW. The spec says the villain can lose and that winning
 *    must feel as designed as losing. It didn't: a fully-walked debt got a
 *    hardcoded yellow bar and the same gloating cat. Clearing your debt now
 *    turns the hero gold, flips the cat to its defeated face, and says so.
 *
 * 3. TOKENS. The palette existed in globals.css and nothing used it — every
 *    surface was hardcoded zinc/emerald/red. Burn red is now reserved for
 *    money at risk, exactly as the tokens say, so it stops being wallpaper.
 */

interface DashboardData {
  user: {
    email: string;
    penaltyRateCentsPerMin: number;
    hasPaymentMethod: boolean;
    lastHeartbeatAt: string | null;
    anchorItems: { tierLevel: number; name: string; priceCents: number }[];
  };
  contract: {
    id: string;
    deletionFeeCents: number;
    lockinEndsAt: string;
    status: string;
  } | null;
  holds: {
    sessionId: string;
    appPackage: string;
    endTime: string;
    purgatoryCents: number;
    burnCents: number;
    redemption: {
      requiredWalkingMinutes: number;
      completedWalkingMinutes: number;
      deadline: string;
      status: string;
    } | null;
  }[];
  totals: {
    purgatoryCents: number;
    requiredWalkingMinutes: number;
    completedWalkingMinutes: number;
  };
  lifetimeLostCents: number;
}

const LABEL = 'font-mono text-[10px] uppercase tracking-[0.2em] text-faint';
const CARD = 'rounded-[var(--radius-card)] border-2 border-line bg-surface p-5';
const INNER = 'rounded-xl border border-line bg-surface-2 p-3';

/**
 * The pairing code. Without this the Android companion can never link, so
 * nothing tracks and nothing bills — it's the bridge between the web account
 * and the device.
 */
function PairingCode() {
  const [otp, setOtp] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  useEffect(() => {
    if (otp && secondsLeft === 0) setOtp(null);
  }, [otp, secondsLeft]);

  async function generate() {
    setState('loading');
    try {
      const res = await fetch('/api/device/link/otp', { method: 'POST' });
      if (!res.ok) throw new Error('otp_failed');
      const body = (await res.json()) as { otp: string; expiresInSeconds: number };
      setOtp(body.otp);
      setSecondsLeft(body.expiresInSeconds);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  return (
    <div className={`mt-3 ${INNER}`}>
      {otp ? (
        <>
          <p className={LABEL}>Pairing code — type this into the app</p>
          <p className="money mt-1 text-3xl font-bold tracking-[0.3em] text-accent">{otp}</p>
          <p className="money mt-1 text-[10px] text-faint">
            expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={state === 'loading'}
          className="w-full rounded-lg border-2 border-accent-dim bg-bg px-3 py-2 font-mono text-xs font-bold text-accent transition hover:border-accent disabled:opacity-50"
        >
          {state === 'loading' ? 'GENERATING…' : '> Generate pairing code_'}
        </button>
      )}
      {state === 'error' && (
        <p className="mt-2 font-mono text-[10px] text-danger">
          Could not generate a code. Are you signed in?
        </p>
      )}
    </div>
  );
}

function useTickingClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('en-GB', { hour12: false });
}

function Empty({ children, cta }: { children: React.ReactNode; cta: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6">
      <CatWidget penaltyCents={0} armed={false} />
      <p className="text-center leading-relaxed text-muted">{children}</p>
      <Link
        href="/onboarding"
        className="rounded-[var(--radius-card)] border-2 border-accent-dim bg-accent px-6 py-3 font-extrabold text-bg transition hover:brightness-110"
      >
        {cta}
      </Link>
    </main>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clock = useTickingClock();

  useEffect(() => {
    const onboarded = window.localStorage.getItem('costly:userId');
    fetch('/api/dashboard')
      .then((r) => {
        if (r.status === 401) throw new Error(onboarded ? 'signed_out' : 'no_user');
        if (!r.ok) throw new Error('load_failed');
        return r.json();
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error === 'no_user') {
    return (
      <Empty cta="FEED THE MACHINE">
        No contract on file. The cat has nothing to eat. It is looking at you.
      </Empty>
    );
  }
  if (error === 'signed_out') {
    return (
      <Empty cta="SIGN BACK IN">
        Your session expired. The debts did not. Sign back in to look at them.
      </Empty>
    );
  }
  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <p className="font-mono text-muted">ERR: couldn&apos;t load your debts. They still exist.</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <p className="animate-pulse font-mono text-accent">counting your money…</p>
      </main>
    );
  }

  const { user, contract, holds, totals, lifetimeLostCents } = data;
  const walkingPct =
    totals.requiredWalkingMinutes > 0
      ? Math.min(100, (totals.completedWalkingMinutes / totals.requiredWalkingMinutes) * 100)
      : 0;
  const armed = user.lastHeartbeatAt !== null;
  const atStake = totals.purgatoryCents;
  const owes = totals.requiredWalkingMinutes > 0;
  const won = owes && walkingPct >= 100;
  const minutesLeft = Math.max(
    0,
    totals.requiredWalkingMinutes - totals.completedWalkingMinutes,
  );
  const soonest = holds
    .map((h) => h.redemption)
    .filter((r): r is NonNullable<typeof r> => r?.status === 'PENDING')
    .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))[0];

  const wishlistTarget =
    user.anchorItems.length > 0
      ? [...user.anchorItems].sort((a, b) => b.tierLevel - a.tierLevel)[0].name
      : null;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6 sm:px-6">
      {/* ── Status bar: identity, liveness, clock ──────────────────────────
          Armed/unarmed used to be visible only as a giant red panel when
          things were wrong. It is a persistent fact about the system, so it
          belongs in persistent chrome. */}
      <header className="flex items-center justify-between rounded-[var(--radius-card)] border-2 border-line bg-surface px-4 py-3">
        <p className="font-mono text-xs tracking-[0.25em] text-accent">COSTLY://TERMINAL</p>
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${
              armed ? 'text-accent' : 'text-danger'
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                armed ? 'animate-pulse bg-accent' : 'bg-danger'
              }`}
            />
            {armed ? 'armed' : 'unarmed'}
          </span>
          <span className="money text-sm text-muted">{clock}</span>
        </div>
      </header>

      <div className="mt-5 space-y-4">
        <CatWidget
          penaltyCents={lifetimeLostCents}
          armed={armed}
          walkingPct={walkingPct}
          wishlistItem={wishlistTarget}
        />

        {/* ── HERO: the money you can still save ─────────────────────────
            Deliberately not "total lost". The recoverable figure is the only
            one the user can still act on, and acting on it is the product. */}
        <section
          className={`rounded-[var(--radius-card)] border-2 p-5 ${
            won ? 'border-gold bg-gold/10' : atStake > 0 ? 'border-burn-dim bg-surface' : 'border-line bg-surface'
          }`}
        >
          <div className="flex items-baseline justify-between">
            <p className={LABEL}>{won ? 'Saved' : 'At stake right now'}</p>
            {soonest && !won && (
              <p className="money text-xs text-burn">captures in {timeLeft(soonest.deadline)}</p>
            )}
          </div>

          <Odometer
            value={eurosExact(atStake)}
            className={`mt-2 block text-6xl font-bold ${won ? 'text-gold' : atStake > 0 ? 'text-burn' : 'text-muted'}`}
          />

          {owes ? (
            <>
              <div className="mt-4 flex items-baseline justify-between">
                <p className={LABEL}>Walk it off</p>
                <p className="money text-xs text-muted">
                  {totals.completedWalkingMinutes}/{totals.requiredWalkingMinutes} min
                </p>
              </div>
              <div
                className="mt-2 h-4 overflow-hidden rounded-full border border-line bg-bg"
                role="progressbar"
                aria-valuenow={Math.round(walkingPct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full transition-[width] duration-700 ease-out ${won ? 'bg-gold' : 'bg-accent'}`}
                  style={{ width: `${walkingPct}%` }}
                />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {won ? (
                  <span className="font-semibold text-gold">
                    Every minute walked back. The hold is released and the cat got nothing.
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-fg">{minutesLeft} minutes</span> on your
                    feet and this money never leaves. The clock does not care about the weather.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Nothing at risk. The cat is unfed — it respects you slightly more, and hates that.
            </p>
          )}
        </section>

        {/* ── Stat strip: the facts that don't need a whole card ──────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className={INNER}>
            <p className={LABEL}>Lost for good</p>
            <p className="money mt-1 text-lg font-bold text-fg">{euros(lifetimeLostCents)}</p>
          </div>
          <div className={INNER}>
            <p className={LABEL}>Your rate</p>
            <p className="money mt-1 text-lg font-bold text-fg">
              {eurosExact(user.penaltyRateCentsPerMin)}
              <span className="text-xs text-faint">/min</span>
            </p>
          </div>
          <div className={INNER}>
            <p className={LABEL}>Open holds</p>
            <p className="money mt-1 text-lg font-bold text-fg">{holds.length}</p>
          </div>
        </div>

        {/* ── Unarmed: the one state that invalidates everything above ────── */}
        {!armed && (
          <section className="rounded-[var(--radius-card)] border-2 border-danger/60 bg-surface p-5">
            <p className="font-mono text-xs tracking-[0.25em] text-danger">SYSTEM UNARMED</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              You signed the contract, but nothing is watching. No screen time is
              tracked and no steps are counted — every number above is theatre
              until a device pairs.
            </p>
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-accent-dim bg-surface-2 p-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-line-strong font-mono text-[10px] text-faint">
                APK
              </div>
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold text-accent">&gt; Install the companion._</p>
                <p className="mt-1 text-xs leading-relaxed text-faint">
                  Grant Usage Access (to catch the scrolling) and Health Connect
                  (to count the steps), then pair with the code below.
                </p>
              </div>
            </div>
            <PairingCode />
          </section>
        )}

        {/* ── Purgatory ──────────────────────────────────────────────────── */}
        {holds.length > 0 && (
          <section className={CARD}>
            <p className={LABEL}>Purgatory</p>
            <ul className="mt-3 space-y-2">
              {holds.map((h) => {
                const done =
                  h.redemption &&
                  h.redemption.completedWalkingMinutes >= h.redemption.requiredWalkingMinutes;
                return (
                  <li key={h.sessionId} className={INNER}>
                    <div className="flex justify-between text-sm">
                      <span className="text-fg">{appName(h.appPackage)}</span>
                      <span className={`money font-bold ${done ? 'text-gold' : 'text-burn'}`}>
                        {euros(h.purgatoryCents)}
                      </span>
                    </div>
                    {h.redemption?.status === 'PENDING' && (
                      <div className="money mt-1 flex justify-between text-xs text-faint">
                        <span>
                          {h.redemption.completedWalkingMinutes}/
                          {h.redemption.requiredWalkingMinutes} min walked
                        </span>
                        <span className={done ? 'text-gold' : 'text-burn'}>
                          {done ? 'released' : `captures in ${timeLeft(h.redemption.deadline)}`}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Contract ───────────────────────────────────────────────────── */}
        {contract && (
          <section className={CARD}>
            <div className="flex items-baseline justify-between">
              <p className={LABEL}>Active contract</p>
              <p className="money text-xs text-muted">
                sealed for {timeLeft(contract.lockinEndsAt)}
              </p>
            </div>
            <p className="money mt-2 text-3xl font-bold text-fg">
              {euros(contract.deletionFeeCents)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {contract.deletionFeeCents > 0
                ? 'Your breach fee. You set this number, and you set it while you still meant it. Delete the app or revoke a permission before the term is served and it is collected.'
                : 'Your breach fee is zero. You insisted. If you run, you lose nothing but the argument.'}
            </p>
          </section>
        )}

        {/* ── Wishlist ───────────────────────────────────────────────────── */}
        {user.anchorItems.length > 0 && (
          <section className={CARD}>
            <p className={LABEL}>Things the cat is eating</p>
            <ul className="mt-3 space-y-2">
              {user.anchorItems.map((a) => {
                const eaten = Math.min(100, (lifetimeLostCents / a.priceCents) * 100);
                return (
                  <li key={a.tierLevel}>
                    <div className="flex justify-between text-sm">
                      <span className="text-fg">{a.name}</span>
                      <span className="money text-muted">{euros(a.priceCents)}</span>
                    </div>
                    {/* How much of each thing has been eaten — the hostage
                        ladder was a flat price list, which taunts nobody. */}
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full bg-burn" style={{ width: `${eaten}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <footer className="pb-4 text-center font-mono text-xs text-faint">
          {armed ? '> system armed. scroll wisely.' : '> unarmed. everything above is theatre.'}
        </footer>
      </div>
    </main>
  );
}
