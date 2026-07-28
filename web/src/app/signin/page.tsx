'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CatWidget } from '@/components/CatWidget';

/**
 * Sign in. This did not exist, which was a hole rather than an omission: the
 * session cookie lasts 30 days, onboarding refuses anyone inside a lock-in,
 * and there was no third door — so a returning user with an expired cookie was
 * locked out of their own dashboard until their contract ran out.
 */
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? 'Could not sign in.');
      window.localStorage.setItem('costly:userId', body.userId);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-4 py-12 sm:px-6">
      <header className="rounded-[var(--radius-card)] border-2 border-line bg-surface px-4 py-3">
        <p className="font-mono text-xs tracking-[0.3em] text-accent">COSTLY://TERMINAL</p>
      </header>

      <CatWidget penaltyCents={0} armed={false} />

      <form
        onSubmit={submit}
        className="rounded-[var(--radius-card)] border-2 border-line bg-surface p-6"
      >
        <h1 className="text-3xl font-extrabold text-fg">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your debts are exactly where you left them.
        </p>

        <label className="mt-5 block">
          <span className="font-mono text-[10px] tracking-widest text-faint">EMAIL</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1 w-full rounded-xl border-2 border-line bg-surface-2 px-4 py-3 text-fg outline-none focus:border-accent"
          />
        </label>

        <label className="mt-4 block">
          <span className="font-mono text-[10px] tracking-widest text-faint">PASSWORD</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border-2 border-line bg-surface-2 px-4 py-3 text-fg outline-none focus:border-accent"
          />
        </label>

        {error && <p className="mt-4 font-mono text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy || !email.includes('@') || password.length === 0}
          className="mt-5 w-full rounded-[var(--radius-card)] border-2 border-accent-dim bg-accent px-6 py-4 font-extrabold text-bg transition enabled:hover:brightness-110 disabled:opacity-30"
        >
          {busy ? 'CHECKING…' : 'SIGN IN'}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        No contract yet?{' '}
        <Link href="/onboarding" className="font-semibold text-accent underline">
          Sign one
        </Link>
      </p>
    </main>
  );
}
