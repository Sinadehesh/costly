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
  name: z.string().trim().min(1),
  priceCents: z.number().int().positive(),
  emoji: z.string().max(8).optional(),
});

const bodySchema = z.object({
  email: z.string().email(),

  // The user states what one hour of their time is worth — no guessing.
  hourlyRateCents: z.number().int().positive(),

  // Up to 5 wishlist products — COMPLETELY OPTIONAL. With them, the taunts
  // get personal ("I took your PlayStation money!"); without them, the app
  // falls back to pure taunts. Tier levels are assigned by ascending price
  // server-side, so the ladder semantics survive without user-facing rules.
  anchorItems: z.array(anchorSchema).max(ANCHOR_TIER_COUNT).default([]),

  // Commitment contract. deletionFeeCents 0 is legal but the UI labels it
  // "Not Recommended" — enforcement of the discouragement is a frontend job.
  deletionFeeCents: z.number().int().min(0).max(MAX_DELETION_FEE_CENTS),
  lockinDays: z.union([z.literal(7), z.literal(30)]),
  termsVersion: z.string().min(1),

  sessionCapCents: z.number().int().positive().max(10000).optional(),
});

/**
 * POST /api/onboarding
 * Upserts the user by email, so re-running onboarding with the same address
 * updates the rate/wishlist/contract instead of dying on the P2002 unique
 * constraint. Re-onboarding an existing user:
 *   - keeps their Stripe customer (and any vaulted card) — never a duplicate
 *     customer for the same person;
 *   - REPLACES the wishlist (deleteMany + create) rather than stacking
 *     duplicates on every run;
 *   - closes any previous ACTIVE contract as COMPLETED before creating the
 *     new one — the dead man's switch must never have two armed contracts,
 *     or a single silence would double-charge.
 * The client then calls /api/stripe/setup-intent to save a card — without a
 * saved payment method the meter must refuse to arm.
 */
export async function POST(req: Request) {
  // TODO(auth): replace email-in-body with a real session once auth lands.
  const body = bodySchema.parse(await req.json());

  // Cheapest wish = tier 1. Sorting here (not in the UI) keeps the taunt
  // ladder's "crossed in order" semantics without burdening the form.
  const rankedAnchors = [...body.anchorItems].sort((a, b) => a.priceCents - b.priceCents);

  const existing = await prisma.user.findUnique({
    where: { email: body.email },
    select: { id: true, stripeCustomerId: true },
  });

  const stripeCustomerId =
    existing?.stripeCustomerId ?? (await stripe.customers.create({ email: body.email })).id;

  if (existing) {
    await prisma.commitmentContract.updateMany({
      where: { userId: existing.id, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    });
  }

  const now = new Date();
  const contractData = {
    deletionFeeCents: body.deletionFeeCents,
    lockinStartsAt: now,
    lockinEndsAt: new Date(now.getTime() + body.lockinDays * 86_400_000),
    acceptedAt: now,
    termsVersion: body.termsVersion,
  };
  const anchorData = rankedAnchors.map((item, idx) => ({
    tierLevel: idx + 1,
    name: item.name,
    priceCents: item.priceCents,
    emoji: item.emoji,
  }));

  const user = await prisma.user.upsert({
    where: { email: body.email },
    create: {
      email: body.email,
      hourlyRateCents: body.hourlyRateCents,
      penaltyRateCentsPerMin: perMinuteRateCents(body.hourlyRateCents),
      sessionCapCents: body.sessionCapCents ?? 3000,
      stripeCustomerId,
      anchorItems: { create: anchorData },
      contracts: { create: contractData },
    },
    update: {
      hourlyRateCents: body.hourlyRateCents,
      penaltyRateCentsPerMin: perMinuteRateCents(body.hourlyRateCents),
      ...(body.sessionCapCents !== undefined ? { sessionCapCents: body.sessionCapCents } : {}),
      anchorItems: { deleteMany: {}, create: anchorData },
      contracts: { create: contractData },
    },
    include: {
      contracts: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return NextResponse.json({
    userId: user.id,
    penaltyRateCentsPerMin: user.penaltyRateCentsPerMin,
    contractId: user.contracts[0].id,
    lockinEndsAt: user.contracts[0].lockinEndsAt,
  });
}
