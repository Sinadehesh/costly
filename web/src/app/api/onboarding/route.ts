import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  ANCHOR_TIER_COUNT,
  MAX_DELETION_FEE_CENTS,
  perMinuteRateCents,
} from '@/lib/penalty';

const anchorSchema = z.object({
  name: z.string().min(1),
  priceCents: z.number().int().positive(),
  emoji: z.string().max(8).optional(),
});

const bodySchema = z.object({
  email: z.string().email(),

  // The user states what one hour of their time is worth — no guessing.
  hourlyRateCents: z.number().int().positive(),

  // Exactly 5 anchors, tier 1..5, strictly ascending prices
  // (coffee → book → dinner → AirPods → PS5).
  anchorItems: z.array(anchorSchema).length(ANCHOR_TIER_COUNT),

  // Commitment contract. deletionFeeCents 0 is legal but the UI labels it
  // "Not Recommended" — enforcement of the discouragement is a frontend job.
  deletionFeeCents: z.number().int().min(0).max(MAX_DELETION_FEE_CENTS),
  lockinDays: z.union([z.literal(7), z.literal(30)]),
  termsVersion: z.string().min(1),

  sessionCapCents: z.number().int().positive().max(10000).optional(),
});

/**
 * POST /api/onboarding
 * Creates the user, the 5-tier anchor ladder, the commitment contract
 * (which arms the dead man's switch), and the Stripe customer. The client
 * then calls /api/stripe/setup-intent to save a card — without a saved
 * payment method the meter must refuse to arm.
 */
export async function POST(req: Request) {
  // TODO(auth): replace email-in-body with a real session once auth lands.
  const body = bodySchema.parse(await req.json());

  for (let i = 1; i < body.anchorItems.length; i++) {
    if (body.anchorItems[i].priceCents <= body.anchorItems[i - 1].priceCents) {
      return NextResponse.json(
        { error: 'anchor_prices_must_escalate', tier: i + 1 },
        { status: 400 },
      );
    }
  }

  const customer = await stripe.customers.create({ email: body.email });
  const now = new Date();

  const user = await prisma.user.create({
    data: {
      email: body.email,
      hourlyRateCents: body.hourlyRateCents,
      penaltyRateCentsPerMin: perMinuteRateCents(body.hourlyRateCents),
      sessionCapCents: body.sessionCapCents ?? 3000,
      stripeCustomerId: customer.id,
      anchorItems: {
        create: body.anchorItems.map((item, idx) => ({
          tierLevel: idx + 1,
          name: item.name,
          priceCents: item.priceCents,
          emoji: item.emoji,
        })),
      },
      contracts: {
        create: {
          deletionFeeCents: body.deletionFeeCents,
          lockinStartsAt: now,
          lockinEndsAt: new Date(now.getTime() + body.lockinDays * 86_400_000),
          acceptedAt: now,
          termsVersion: body.termsVersion,
        },
      },
    },
    include: { contracts: true },
  });

  return NextResponse.json({
    userId: user.id,
    penaltyRateCentsPerMin: user.penaltyRateCentsPerMin,
    contractId: user.contracts[0].id,
    lockinEndsAt: user.contracts[0].lockinEndsAt,
  });
}
