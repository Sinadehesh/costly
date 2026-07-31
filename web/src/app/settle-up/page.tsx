/**
 * Where Stripe Checkout redirects after the Settle Up payment. This is just a
 * confirmation surface — the actual account unlock is driven by the webhook
 * (checkout.session.completed / payment_intent.succeeded → ACTIVE), and the
 * Android app clears its local lock on the next successful heartbeat.
 *
 * Note the restraint: somebody landing here has just paid a penalty, and the
 * villain does not get to gloat about a payment that has already hurt. It
 * states the fact and gets out of the way.
 */
export default async function SettleUpPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const paid = status === 'success';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-xs tracking-[0.3em] text-accent">COSTLY</p>
      <h1 className={`text-3xl font-extrabold ${paid ? 'text-accent' : 'text-fg'}`}>
        {paid ? 'Balance cleared.' : 'Payment cancelled.'}
      </h1>
      <p className="text-sm leading-relaxed text-muted">
        {paid
          ? 'Your account is being unlocked. Reopen Costly: the meter is armed again, and so are we.'
          : 'Nothing was charged. Your account is still locked until the balance clears.'}
      </p>
    </main>
  );
}
