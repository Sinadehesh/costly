/**
 * Where Stripe Checkout redirects after the Settle Up payment. This is just a
 * confirmation surface — the actual account unlock is driven by the webhook
 * (checkout.session.completed / payment_intent.succeeded → ACTIVE), and the
 * Android app clears its local lock on the next successful heartbeat.
 */
export default async function SettleUpPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const paid = status === 'success';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <p className="font-mono text-xs tracking-[0.3em] text-emerald-400">COSTLY</p>
      <h1 className={`text-3xl font-extrabold ${paid ? 'text-emerald-400' : 'text-zinc-300'}`}>
        {paid ? 'Balance cleared.' : 'Payment cancelled.'}
      </h1>
      <p className="text-sm leading-relaxed text-zinc-400">
        {paid
          ? 'Your account is being unlocked. Reopen Costly — the meter is armed again, and so are we.'
          : 'Nothing was charged. Your account is still locked until the balance clears.'}
      </p>
    </main>
  );
}
