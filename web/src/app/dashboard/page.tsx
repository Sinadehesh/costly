'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { euros, eurosExact, timeLeft } from '@/lib/format';

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
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted">No contract on file. How refreshing. How temporary.</p>
        <Link href="/onboarding" className="rounded-card bg-accent px-6 py-3 font-semibold text-bg">
          Sign one
        </Link>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <p className="text-muted">Couldn&apos;t load your debts. They still exist.</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <p className="money animate-pulse text-muted">Counting your money…</p>
      </main>
    );
  }

  const { user, contract, holds, totals } = data;
  const walkingPct =
    totals.requiredWalkingMinutes > 0
      ? Math.min(100, (totals.completedWalkingMinutes / totals.requiredWalkingMinutes) * 100)
      : 0;
  const armed = user.lastHeartbeatAt !== null;

  return (
    <main className="mx-auto min-h-screen max-w-md space-y-6 px-6 py-10">
      <header className="flex items-baseline justify-between">
        <p className="money text-xs tracking-[0.3em] text-accent">COSTLY / PURGATORY</p>
        <p className="money text-xs text-muted">{eurosExact(user.penaltyRateCentsPerMin)}/min</p>
      </header>

      {/* ── Armed / unarmed ─────────────────────────────────────────────── */}
      {!armed && (
        <section className="rounded-card border border-burn/40 bg-burn/10 p-5">
          <p className="money text-xs tracking-widest text-burn">SYSTEM UNARMED</p>
          <p className="mt-2 text-sm leading-relaxed">
            You signed a contract and installed nothing. Adorable. Until the
            Android app is linked, no meter runs, no minutes count — and the
            person you were escaping is still in charge.
          </p>
          <div className="mt-4 flex items-center gap-4 rounded-card bg-bg p-4">
            <div className="money flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted text-[10px] text-muted">
              QR / APK
            </div>
            <div className="text-sm text-muted">
              <p className="font-semibold text-fg">Get the companion app</p>
              <p className="mt-1">
                Install → grant Accessibility + Health → it phones home and the
                switch arms itself.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── The contract ────────────────────────────────────────────────── */}
      {contract ? (
        <section className="rounded-card bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <p className="money text-xs tracking-widest text-muted">ACTIVE CONTRACT</p>
            <p className="money text-xs text-muted">lock-in ends in {timeLeft(contract.lockinEndsAt)}</p>
          </div>
          <p className="money mt-3 text-5xl text-burn">{euros(contract.deletionFeeCents)}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {contract.deletionFeeCents > 0 ? (
              <>
                hangs over your head until{' '}
                {new Date(contract.lockinEndsAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                })}
                . Delete the app, revoke a permission, go dark for 24 hours —
                and we collect. You wrote this rule. We just enforce it.
              </>
            ) : (
              <>
                Your deletion fee is zero. You insisted. If you vanish, you lose
                nothing but the argument.
              </>
            )}
          </p>
        </section>
      ) : (
        <section className="rounded-card bg-surface p-5">
          <p className="money text-xs tracking-widest text-gold">NO ACTIVE CONTRACT</p>
          <p className="mt-2 text-sm text-muted">
            Lock-in served. You&apos;re free — technically. Renew before the
            scrolling notices you stopped paying for it.
          </p>
        </section>
      )}

      {/* ── The purgatory wallet ────────────────────────────────────────── */}
      <section className="rounded-card bg-surface p-5">
        <p className="money text-xs tracking-widest text-muted">PURGATORY WALLET</p>
        <p className="money mt-3 text-4xl">
          {euros(totals.purgatoryCents)}
          <span className="ml-2 text-sm text-muted">on hold</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          Still your money. For now. Walk or forfeit.
        </p>

        {holds.length > 0 && (
          <ul className="mt-4 space-y-3">
            {holds.map((h) => (
              <li key={h.sessionId} className="rounded-lg bg-bg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">{h.appPackage.split('.').pop()}</span>
                  <span className="money">{euros(h.purgatoryCents)}</span>
                </div>
                {h.redemption && h.redemption.status === 'PENDING' && (
                  <div className="money mt-1 flex justify-between text-xs text-muted">
                    <span>
                      {h.redemption.completedWalkingMinutes}/{h.redemption.requiredWalkingMinutes} min walked
                    </span>
                    <span className="text-burn">captures in {timeLeft(h.redemption.deadline)}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Redemption progress ─────────────────────────────────────────── */}
      <section className="rounded-card bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <p className="money text-xs tracking-widest text-muted">SWEAT EQUITY</p>
          <p className="money text-xs text-muted">
            {totals.completedWalkingMinutes}/{totals.requiredWalkingMinutes} min
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg">
          <div
            className={`h-full rounded-full transition-all ${walkingPct >= 100 ? 'bg-gold' : 'bg-accent'}`}
            style={{ width: `${walkingPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {totals.requiredWalkingMinutes === 0 ? (
            <>Nothing owed. You gave us nothing to hold. Noted. Grudgingly.</>
          ) : walkingPct >= 100 ? (
            <span className="text-gold">
              Debt walked off. Your money crawls back to you. We hate this for us.
            </span>
          ) : (
            <>
              Two minutes on your feet per minute you scrolled. The clock does
              not care about the weather.
            </>
          )}
        </p>
      </section>

      {/* ── The ladder ──────────────────────────────────────────────────── */}
      <section className="rounded-card bg-surface p-5">
        <p className="money text-xs tracking-widest text-muted">THE HOSTAGE LADDER</p>
        <ul className="mt-3 space-y-2">
          {user.anchorItems.map((a) => (
            <li key={a.tierLevel} className="flex justify-between text-sm">
              <span>
                <span className="money mr-2 text-xs text-muted">T{a.tierLevel}</span>
                {a.name}
              </span>
              <span className="money text-muted">{euros(a.priceCents)}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="pb-6 text-center text-xs text-muted">
        {armed ? (
          <>The switch is armed. Scroll wisely.</>
        ) : (
          <>Unarmed. Everything above is theater until the app is installed.</>
        )}
      </footer>
    </main>
  );
}
