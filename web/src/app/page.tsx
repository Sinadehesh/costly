import Link from 'next/link';
import { CatWidget } from '@/components/CatWidget';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 bg-zinc-950 px-4 py-12 sm:px-6">
      <header className="rounded-xl border-4 border-gray-800 bg-black px-4 py-3">
        <p className="font-mono text-xs tracking-[0.3em] text-emerald-400">COSTLY://TERMINAL</p>
      </header>

      {/* The cat greets you. It is already thinking about your money. */}
      <CatWidget penaltyCents={1200} className="-rotate-2" />

      <section className="rounded-xl border-4 border-gray-800 bg-black p-6">
        <h1 className="text-4xl font-extrabold leading-tight text-white">
          Your scrolling is <span className="text-red-500">our revenue.</span>
        </h1>
        <p className="mt-4 leading-relaxed text-zinc-400">
          Every minute you doomscroll, we charge you your own hourly rate. You
          can walk 80% of it back — two minutes on your feet for every minute
          on your back. The other 20% is ours. Forever. We are not a wellness
          app. We are the consequence.
        </p>
      </section>

      <Link
        href="/onboarding"
        className="rounded-xl border-4 border-gray-800 bg-emerald-500 px-6 py-4 text-center text-lg font-extrabold text-zinc-950 transition hover:brightness-110"
      >
        SIGN THE CONTRACT
      </Link>

      <p className="text-center font-mono text-xs text-zinc-600">
        &gt; real card. real charges. real consequences. that&apos;s the point.
      </p>
    </main>
  );
}
