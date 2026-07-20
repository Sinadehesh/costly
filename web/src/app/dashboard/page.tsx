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
              You signed the contract, but the system cannot track your
              physical laziness yet. The cat is waiting for your step count.
              It will remember if you refuse to stand up.
            </p>
            {/* TODO(health): wire to the Health Hub consent/deep-link flow. */}
            <button
              type="button"
              className="mt-4 w-full rounded-lg border-2 border-emerald-500 bg-zinc-950 px-4 py-4 text-left transition hover:bg-emerald-500/10"
            >
              <span className="block font-mono text-sm font-bold text-emerald-400">
                &gt; Connect Health Hub._
              </span>
              <span className="mt-1 block font-mono text-xs text-zinc-500">
                Grant access to your walking data to arm the system.
              </span>
            </button>
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
