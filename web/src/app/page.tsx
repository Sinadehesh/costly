import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div>
        <p className="money text-sm tracking-[0.3em] text-accent">COSTLY</p>
        <h1 className="mt-4 text-4xl font-bold leading-tight">
          Your scrolling is <span className="text-burn">our revenue.</span>
        </h1>
        <p className="mt-4 leading-relaxed text-muted">
          Every minute you doomscroll, we charge you your own hourly rate. You
          can walk 80% of it back — two minutes on your feet for every minute
          on your back. The other 20% is ours. Forever. We are not a wellness
          app. We are the consequence.
        </p>
      </div>
      <Link
        href="/onboarding"
        className="rounded-card bg-accent px-6 py-4 text-center text-lg font-semibold text-bg transition hover:brightness-110"
      >
        Sign the contract
      </Link>
      <p className="text-center text-xs text-muted">
        Real card. Real charges. Real consequences. That&apos;s the point.
      </p>
    </main>
  );
}
