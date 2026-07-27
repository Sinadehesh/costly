'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CatWidget } from '@/components/CatWidget';
import { euros, eurosExact, timeLeft } from '@/lib/format';

/**
 * THE TERMINAL — Hostile Arcade dashboard.
 * Stark black canvas, chunky arcade-console borders, mono for every number.
 * The cat floats over it in a bright card, reacting to how much you've fed it.
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

/**
 * The pairing code. Without this the Android companion can never link, so
 * nothing tracks and nothing bills — it's the bridge between the web account
 * and the device. POSTs to /api/device/link/otp (JWT-authed) and shows the
 * short-lived 6-digit code for the user to type into the arming screen.
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

  // The code is dead once it expires — stop showing a number that won't work.
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
    <div className="mt-3 rounded-lg border-2 border-gray-800 bg-black p-3">
      {otp ? (
        <>
          <p className="font-mono text-[10px] tracking-widest text-zinc-500">
            PAIRING CODE — TYPE THIS INTO THE APP
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] tabular-nums text-emerald-400">
            {otp}
          </p>
          <p className="mt-1 font-mono text-[10px] tabular-nums text-zinc-600">
            expires in {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, '0')}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={state === 'loading'}
          className="w-full rounded-md border-2 border-emerald-500 bg-zinc-950 px-3 py-2 font-mono text-xs font-bold text-emerald-400 disabled:opacity-50"
        >
          {state === 'loading' ? 'GENERATING…' : '> Generate pairing code_'}
        </button>
      )}
      {state === 'error' && (
        <p className="mt-2 font-mono text-[10px] text-red-500">
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clock = useTickingClock();

  useEffect(() => {
    const userId = window.localStorage.getItem('costly:userId');
    if (!userId) {
      setError('no_user');
      return;
    }
    fetch(`/api/dashboard?userId=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load_failed'))))
      .then(setData)
      .catch(() => setError('load_failed'));
  }, []);

  if (error === 'no_user') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 bg-zinc-950 px-6">
        <p className="text-center text-zinc-400">
          No contract on file. The cat has nothing to eat. It is looking at you.
        </p>
        <Link
          href="/onboarding"
          className="rounded-xl border-4 border-gray-800 bg-emerald-500 px-6 py-3 font-extrabold text-zinc-950"
        >
          FEED THE MACHINE
        </Link>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-zinc-950 px-6">
        <p className="font-mono text-zinc-400">ERR: couldn&apos;t load your debts. They still exist.</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-zinc-950 px-6">
        <p className="animate-pulse font-mono text-emerald-400">counting your money…</p>
      </main>
    );
  }

  const { user, contract, holds, totals, lifetimeLostCents } = data;
  const walkingPct =
    totals.requiredWalkingMinutes > 0
      ? Math.min(100, (totals.completedWalkingMinutes / totals.requiredWalkingMinutes) * 100)
      : 0;
  const armed = user.lastHeartbeatAt !== null;
  // The cat attacks the priciest wish it can plausibly claim to have eaten;
  // no wishlist = pure-taunt mode, by design.
  const wishlistTarget =
    user.anchorItems.length > 0
      ? [...user.anchorItems].sort((a, b) => b.tierLevel - a.tierLevel)[0].name
      : null;

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-zinc-950 px-4 py-8 sm:px-6">
      {/* ── Terminal header ─────────────────────────────────────────────── */}
      <header className="flex items-baseline justify-between rounded-xl border-4 border-gray-800 bg-black px-4 py-3">
        <p className="font-mono text-xs tracking-[0.25em] text-emerald-400">COSTLY://TERMINAL</p>
        <p className="font-mono text-sm tabular-nums text-emerald-400">{clock}</p>
      </header>

      <div className="relative mt-6 space-y-5">
        {/* The cat floats over the console. */}
        <CatWidget
          penaltyCents={lifetimeLostCents}
          wishlistItem={lifetimeLostCents > 0 ? wishlistTarget : null}
          className="relative z-10 sm:absolute sm:-top-2 sm:right-0 sm:z-10 sm:max-w-xs sm:-rotate-2"
        />

        {/* ── Money lost ─────────────────────────────────────────────────── */}
        <section className="rounded-xl border-4 border-gray-800 bg-black p-5 sm:pt-14">
          <p className="font-mono text-xs tracking-[0.25em] text-zinc-500">TOTAL MONEY LOST</p>
          <p className="mt-2 font-mono text-5xl font-bold tabular-nums text-white">
            {eurosExact(lifetimeLostCents)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border-2 border-gray-800 bg-zinc-950 p-3">
              <p className="font-mono text-[10px] tracking-widest text-zinc-500">AT STAKE (HOLDS)</p>
              <p className="mt-1 font-mono text-xl tabular-nums text-emerald-400">
                {euros(totals.purgatoryCents)}
              </p>
            </div>
            <div className="rounded-lg border-2 border-gray-800 bg-zinc-950 p-3">
              <p className="font-mono text-[10px] tracking-widest text-zinc-500">YOUR RATE</p>
              <p className="mt-1 font-mono text-xl tabular-nums text-emerald-400">
                {eurosExact(user.penaltyRateCentsPerMin)}/min
              </p>
            </div>
          </div>
        </section>

        {/* ── Unarmed warning ────────────────────────────────────────────── */}
        {!armed && (
          <section className="rounded-xl border-4 border-red-900 bg-black p-5">
            <p className="font-mono text-xs tracking-[0.25em] text-red-500">SYSTEM UNARMED</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              You signed the contract, but the system is blind. The cat cannot
              track your screen time, and it cannot see your step count. It is
              waiting.
            </p>
            {/* The Android companion is the single source of truth for BOTH
                tracking fronts: Usage Access (which app is in the foreground,
                feeding the heuristic scroll engine) + Health Connect (steps).
                No AccessibilityService — Play restricts it to accessibility
                uses. The web only listens for the companion's pings. */}
            <div className="mt-4 flex items-center gap-4 rounded-lg border-2 border-emerald-500 bg-zinc-950 p-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-zinc-600 font-mono text-[10px] text-zinc-500">
                QR / APK
              </div>
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold text-emerald-400">
                  &gt; Install Companion App._
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Download the Android APK. Grant Usage Access (to catch the
                  scrolling) AND Health Connect (to track steps), then pair the
                  device with the code below to arm the system.
                </p>
              </div>
            </div>
            <PairingCode />
          </section>
        )}

        {/* ── Contract ───────────────────────────────────────────────────── */}
        {contract && (
          <section className="rounded-xl border-4 border-gray-800 bg-black p-5">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-xs tracking-[0.25em] text-zinc-500">ACTIVE CONTRACT</p>
              <p className="font-mono text-xs tabular-nums text-zinc-500">
                lock-in ends {timeLeft(contract.lockinEndsAt)}
              </p>
            </div>
            <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-red-500">
              {euros(contract.deletionFeeCents)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {contract.deletionFeeCents > 0
                ? 'The desertion fee. Delete the app or revoke a permission during lock-in and this is collected automatically. You wrote this rule while you still meant it.'
                : 'Your desertion fee is zero. You insisted. If you run, you lose nothing but the argument.'}
            </p>
          </section>
        )}

        {/* ── Purgatory holds ────────────────────────────────────────────── */}
        {holds.length > 0 && (
          <section className="rounded-xl border-4 border-gray-800 bg-black p-5">
            <p className="font-mono text-xs tracking-[0.25em] text-zinc-500">PURGATORY</p>
            <ul className="mt-3 space-y-3">
              {holds.map((h) => (
                <li key={h.sessionId} className="rounded-lg border-2 border-gray-800 bg-zinc-950 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">{h.appPackage.split('.').pop()}</span>
                    <span className="font-mono tabular-nums text-white">{euros(h.purgatoryCents)}</span>
                  </div>
                  {h.redemption?.status === 'PENDING' && (
                    <div className="mt-1 flex justify-between font-mono text-xs tabular-nums text-zinc-500">
                      <span>
                        {h.redemption.completedWalkingMinutes}/{h.redemption.requiredWalkingMinutes} min
                        walked
                      </span>
                      <span className="text-red-500">captures in {timeLeft(h.redemption.deadline)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Walk-it-off progress ───────────────────────────────────────── */}
        <section className="rounded-xl border-4 border-gray-800 bg-black p-5">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-xs tracking-[0.25em] text-zinc-500">WALK IT OFF</p>
            <p className="font-mono text-xs tabular-nums text-zinc-500">
              {totals.completedWalkingMinutes}/{totals.requiredWalkingMinutes} min
            </p>
          </div>
          <div className="mt-3 h-5 overflow-hidden rounded-lg border-2 border-gray-800 bg-zinc-950">
            <div
              className={`h-full ${walkingPct >= 100 ? 'bg-yellow-400' : 'bg-emerald-500'}`}
              style={{ width: `${walkingPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {totals.requiredWalkingMinutes === 0
              ? 'Nothing owed. The cat is unfed. It respects you slightly more, and hates that.'
              : walkingPct >= 100
                ? 'Debt walked off. Your money crawls back to you. The cat is furious.'
                : 'Two minutes on your feet per minute you scrolled. The clock does not care about the weather.'}
          </p>
        </section>

        {/* ── Wishlist (only if they named wishes) ───────────────────────── */}
        {user.anchorItems.length > 0 && (
          <section className="rounded-xl border-4 border-gray-800 bg-black p-5">
            <p className="font-mono text-xs tracking-[0.25em] text-zinc-500">
              THINGS THE CAT IS EATING
            </p>
            <ul className="mt-3 space-y-2">
              {user.anchorItems.map((a) => (
                <li key={a.tierLevel} className="flex justify-between text-sm">
                  <span className="text-zinc-300">
                    <span className="mr-2 font-mono text-xs text-zinc-600">T{a.tierLevel}</span>
                    {a.name}
                  </span>
                  <span className="font-mono tabular-nums text-zinc-500">{euros(a.priceCents)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="pb-4 text-center font-mono text-xs text-zinc-600">
          {armed ? '> system armed. scroll wisely.' : '> unarmed. everything above is theater.'}
        </footer>
      </div>
    </main>
  );
}
