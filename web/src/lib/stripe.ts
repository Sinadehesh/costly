import Stripe from 'stripe';

/**
 * Lazily-constructed Stripe client.
 *
 * `new Stripe(key)` throws immediately when the key is missing, and route
 * modules are IMPORTED at build time (Next's "collecting page data" step).
 * Constructing at module scope therefore broke `next build` on any machine
 * without STRIPE_SECRET_KEY set — including CI and a fresh clone.
 *
 * The Proxy defers construction to the first real property access, which only
 * happens while handling a request. Call sites are unchanged: `stripe.foo(...)`
 * still works exactly as before.
 */
let client: Stripe | null = null;

function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY is not set — payments cannot be processed. ' +
          'Set it in the environment (see web/.env.example).',
      );
    }
    client = new Stripe(key, { typescript: true });
  }
  return client;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});
