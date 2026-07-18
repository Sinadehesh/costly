import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

const bodySchema = z.object({
  userId: z.string(),
  setupIntentId: z.string(),
});

/**
 * POST /api/stripe/setup-complete
 * Belt-and-braces twin of the setup_intent.succeeded webhook: the frontend
 * calls this right after confirmSetup so a saved card is usable immediately
 * (and in local dev without webhook forwarding). Everything is verified
 * against Stripe server-side — the client's word counts for nothing.
 */
export async function POST(req: Request) {
  const { userId, setupIntentId } = bodySchema.parse(await req.json());

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

  if (
    setupIntent.status !== 'succeeded' ||
    setupIntent.customer !== user.stripeCustomerId ||
    typeof setupIntent.payment_method !== 'string'
  ) {
    return NextResponse.json({ error: 'setup_intent_not_valid' }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { stripePaymentMethodId: setupIntent.payment_method },
  });

  return NextResponse.json({ ok: true });
}
