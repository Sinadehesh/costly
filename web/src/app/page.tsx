import Link from 'next/link';
import { CatWidget } from '@/components/CatWidget';

/**
 * The pitch, in the order a stranger actually needs it:
 * what it does → what it costs → how you get it back → the honest warning.
 *
 * The old page led with the threat and buried the redemption in a paragraph.
 * That reads as a punishment app, which is the single most common misreading
 * of this product — and the answer to it (80% is walkable back) is the most
 * persuasive thing we have. It gets its own row now.
 */
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-4 py-12 sm:px-6">
      <header className="rounded-[var(--radius-card)] border-2 border-line bg-surface px-4 py-3">
        <p className="font-mono text-xs tracking-[0.3em] text-accent">COSTLY://TERMINAL</p>
      </header>

      <CatWidget penaltyCents={1200} wishlistItem="PlayStation" className="-rotate-1" />

      <section className="rounded-[var(--radius-card)] border-2 border-line bg-surface p-6">
        <h1 className="text-4xl leading-tight font-extrabold text-fg">
          Your scrolling is <span className="text-burn">our revenue.</span>
        </h1>
        <p className="mt-4 leading-relaxed text-muted">
          Open Instagram and a meter starts charging your card at your own
          hourly rate. Close it and the money sits in purgatory for 24 hours.
        </p>

        {/* The two outcomes, side by side. The whole mechanic is that YOU pick
            which one happens, and a paragraph can't show a fork. */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-accent-dim bg-surface-2 p-3">
            <p className="money text-2xl font-bold text-accent">80%</p>
            <p className="mt-1 text-xs leading-snug text-muted">
              Walk it off. two minutes on your feet per minute scrolled. and
              you keep it.
            </p>
          </div>
          <div className="rounded-xl border border-burn-dim bg-surface-2 p-3">
            <p className="money text-2xl font-bold text-burn">20%</p>
            <p className="mt-1 text-xs leading-snug text-muted">
              Gone the moment you close the app. The time was not refundable
              either.
            </p>
          </div>
        </div>
      </section>

      <Link
        href="/onboarding"
        className="rounded-[var(--radius-card)] border-2 border-accent-dim bg-accent px-6 py-4 text-center text-lg font-extrabold text-bg transition hover:brightness-110"
      >
        SIGN THE CONTRACT
      </Link>

      <p className="text-center font-mono text-xs text-faint">
        &gt; real card. real charges. real consequences. that&apos;s the point.
      </p>
    </main>
  );
}
