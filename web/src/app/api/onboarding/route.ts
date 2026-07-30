import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { requireSession } from '@/lib/jwt';
import {
  ANCHOR_TIER_COUNT,
  MAX_DAILY_FREE_MINUTES,
  MAX_DELETION_FEE_CENTS,
  perMinuteRateCents,
} from '@/lib/penalty';

const anchorSchema = z.object({
  name: z.string().trim().min(1),
  priceCents: z.number().int().positive(),
  emoji: z.string().max(8).optional(),
});

// Identity is NOT in this body any more. The user signs in (Google, or email
// and password) immediately before the card step, so by the time these terms
// arrive there is already a session, and the account they attach to is decided
// by the cookie rather than by whatever address the client claimed.
const bodySchema = z.object({
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

  // Explicit, separate consent to performance starting inside the statutory
  // 14-day withdrawal period. Literal true — the schema refuses false rather
  // than defaulting it, so a client that omits it cannot create a contract
  // that looks consented-to. This is the mechanism the whole business model
  // rests on: without it every charge in the first two weeks is reclaimable.
  withdrawalConsent: z.literal(true),
  withdrawalTermsVersion: z.string().min(1),

  sessionCapCents: z.number().int().positive().max(10000).optional(),

  // Minutes per local day that cost nothing. Capped server-side so it can't
  // be set high enough to silently disable the meter; the UI argues for 0-5.
  dailyFreeMinutes: z.number().int().min(0).max(MAX_DAILY_FREE_MINUTES).default(0),
});

/**
 * POST /api/onboarding
 * Saves the contract terms for the SIGNED-IN user. Sign-in happens one step
 * earlier, so identity comes from the session cookie and never from the body.
 *
 * Keeps the Stripe customer if one exists, replaces the wishlist rather than
 * stacking it, and closes any previous ACTIVE contract so the dead man's switch
 * can never have two armed at once. It REFUSES for an armed user still inside a
 * lock-in (409), because this route closing contracts is exactly what would
 * make every term renegotiable.
 *
 * The client then calls /api/stripe/setup-intent to save a card. Without a
 * saved payment method the meter refuses to arm.
 */
export async function POST(req: Request) {
  const userId = await requireSession(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'unauthenticated', message: 'Sign in before saving your contract.' },
      { status: 401 },
    );
  }

  // A bare .parse() throws past the handler, so Next answers with a 500 whose
  // body isn't JSON — and the client's `(await res.json()).error` then throws
  // its own parse error on top. The user sees a syntax error instead of the
  // field they got wrong, which makes every onboarding failure undiagnosable.
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: 'invalid_request',
        field: issue?.path.join('.') ?? null,
        message: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Malformed body.',
        issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // Everything below talks to Postgres or Stripe, and both fail in ways an
  // unhandled throw renders as an HTML 500 — indistinguishable, from the form,
  // from a broken form. The two that actually bite here are a missing
  // STRIPE_SECRET_KEY/DATABASE_URL and a database that has not had the latest
  // migrations applied (Prisma P2021/P2022: relation or column does not
  // exist). Surface the reason outside production; log it always.
  try {
    return await onboard(userId, body);
  } catch (err) {
    console.error('onboarding failed', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: 'onboarding_failed',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Onboarding failed. Check the server logs.'
            : `Onboarding failed: ${detail.split('\n').slice(0, 4).join(' ').slice(0, 400)}`,
      },
      { status: 500 },
    );
  }
}

async function onboard(userId: string, body: z.infer<typeof bodySchema>) {
  // Cheapest wish = tier 1. Sorting here (not in the UI) keeps the taunt
  // ladder's "crossed in order" semantics without burdening the form.
  const rankedAnchors = [...body.anchorItems].sort((a, b) => a.priceCents - b.priceCents);

  // The account already exists: sign-in created it one request ago. Resolved by
  // session, never by an address in the body.
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true, stripePaymentMethodId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 401 });
  }

  // THE TERMS ARE SEALED FOR THE LOCK-IN. This route closing the ACTIVE
  // contract is what would otherwise make every term renegotiable: sign 30 days
  // at EUR1000, re-run onboarding tomorrow, walk away with no breach fee and a
  // softer contract. Rate, allowance, cap and fee are all terms agreed for a
  // fixed period, and the product is that you cannot renegotiate them with
  // yourself at the moment you most want to. Changing them is what /renew is
  // for, once the time is served.
  //
  // Carve-out: no saved card means arming was never finished (the contract is
  // written before the card is vaulted), so an abandoned run must not brick the
  // account. Nobody was ever under that contract; the switch arms on the first
  // device ping.
  if (existing.stripePaymentMethodId) {
    const sealed = await prisma.commitmentContract.findFirst({
      where: { userId: existing.id, status: 'ACTIVE', lockinEndsAt: { gt: new Date() } },
      select: { id: true, lockinEndsAt: true },
    });
    if (sealed) {
      return NextResponse.json(
        {
          error: 'lockin_not_expired',
          contractId: sealed.id,
          lockinEndsAt: sealed.lockinEndsAt,
          // Spelled out because the bare code reads like a crash to whoever
          // hits it. This is a refusal on purpose, and the user needs to know
          // it is their own contract holding, not a broken form.
          message:
            `You are already under contract until ` +
            `${sealed.lockinEndsAt.toISOString().slice(0, 10)}. Its terms are sealed ` +
            `until then, which is the point of signing one.`,
        },
        { status: 409 },
      );
    }
  }

  const stripeCustomerId =
    existing.stripeCustomerId ?? (await stripe.customers.create({ email: existing.email })).id;

  // Never two armed contracts at once: a single silence would double-charge.
  await prisma.commitmentContract.updateMany({
    where: { userId: existing.id, status: 'ACTIVE' },
    data: { status: 'COMPLETED' },
  });

  const now = new Date();
  const anchorData = rankedAnchors.map((item, idx) => ({
    tierLevel: idx + 1,
    name: item.name,
    priceCents: item.priceCents,
    emoji: item.emoji,
  }));

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      hourlyRateCents: body.hourlyRateCents,
      penaltyRateCentsPerMin: perMinuteRateCents(body.hourlyRateCents),
      dailyFreeMinutes: body.dailyFreeMinutes,
      stripeCustomerId,
      ...(body.sessionCapCents !== undefined ? { sessionCapCents: body.sessionCapCents } : {}),
      // Replace rather than stack, so re-running never duplicates the ladder.
      anchorItems: { deleteMany: {}, create: anchorData },
      contracts: {
        create: {
          deletionFeeCents: body.deletionFeeCents,
          lockinStartsAt: now,
          lockinEndsAt: new Date(now.getTime() + body.lockinDays * 86_400_000),
          acceptedAt: now,
          termsVersion: body.termsVersion,
          // Recorded at the same instant but under its own fields: the
          // withdrawal exception stands or falls on this specific consent,
          // not the general terms.
          withdrawalConsentAt: now,
          withdrawalTermsVersion: body.withdrawalTermsVersion,
        },
      },
    },
    include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  return NextResponse.json({
    userId: user.id,
    penaltyRateCentsPerMin: user.penaltyRateCentsPerMin,
    contractId: user.contracts[0].id,
    lockinEndsAt: user.contracts[0].lockinEndsAt,
  });
}
