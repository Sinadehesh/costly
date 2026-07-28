import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { SESSION_COOKIE, signSession } from '@/lib/jwt';
import { MIN_PASSWORD_LENGTH, hashPassword } from '@/lib/password';
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

const bodySchema = z.object({
  email: z.string().email(),

  // Ordinary sign-in credential. Without it a returning user whose
  // session cookie expired has no way back into their own account —
  // onboarding refuses them mid-lock-in, by design.
  password: z.string().min(MIN_PASSWORD_LENGTH),

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
 * It REFUSES entirely for an armed user still inside a lock-in (409): the
 * terms are sealed for the period, and this route closing contracts is
 * exactly what would otherwise make them negotiable. See the guard below.
 * The client then calls /api/stripe/setup-intent to save a card — without a
 * saved payment method the meter must refuse to arm.
 */
export async function POST(req: Request) {
  // TODO(auth): replace email-in-body with a real session once auth lands.

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
    return await onboard(body);
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

async function onboard(body: z.infer<typeof bodySchema>) {
  // Cheapest wish = tier 1. Sorting here (not in the UI) keeps the taunt
  // ladder's "crossed in order" semantics without burdening the form.
  const rankedAnchors = [...body.anchorItems].sort((a, b) => a.priceCents - b.priceCents);

  const existing = await prisma.user.findUnique({
    where: { email: body.email },
    select: {
      id: true,
      stripeCustomerId: true,
      stripePaymentMethodId: true,
      passwordHash: true,
    },
  });

  // THE TERMS ARE SEALED FOR THE LOCK-IN. Re-onboarding used to close the
  // ACTIVE contract as COMPLETED unconditionally, which made it the back door
  // around everything /cancel and /renew refuse to do: sign 30 days at €1000,
  // re-onboard tomorrow, walk away with no breach fee and a fresh, softer
  // contract. Rate, free allowance, cap and fee are all terms you agreed to
  // for a fixed period — the whole product is that you cannot renegotiate
  // them with yourself at the moment you most want to. Changing them is what
  // /renew is for, once the time is served.
  //
  // Carve-out: a user with no saved card never finished arming (the contract
  // is created at step 3, the card vaults at step 4), so an abandoned
  // onboarding must not brick the address forever. They were never actually
  // under contract — the dead man's switch only arms on the first ping.
  //
  // Second carve-out: an account with no password predates sign-in and has no
  // way back in at all — refusing it here would lock that user out of their own
  // dashboard permanently, which is strictly worse than the loophole. The
  // loophole closes by itself, because this run sets their password.
  if (existing?.stripePaymentMethodId && existing.passwordHash) {
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
          // hits it — this is a refusal on purpose, and the user needs to know
          // it's their own contract holding, not a broken form.
          message:
            `This email is already under contract until ` +
            `${sealed.lockinEndsAt.toISOString().slice(0, 10)}. Its terms are sealed ` +
            `until then — that is the point of signing one. Use the dashboard, or ` +
            `a different email.`,
        },
        { status: 409 },
      );
    }
  }

  const passwordHash = await hashPassword(body.password);

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
    // Recorded at the same instant but under its own fields — the withdrawal
    // exception stands or falls on this specific consent, not the general ToS.
    withdrawalConsentAt: now,
    withdrawalTermsVersion: body.withdrawalTermsVersion,
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
      passwordHash,
      hourlyRateCents: body.hourlyRateCents,
      penaltyRateCentsPerMin: perMinuteRateCents(body.hourlyRateCents),
      sessionCapCents: body.sessionCapCents ?? 3000,
      dailyFreeMinutes: body.dailyFreeMinutes,
      stripeCustomerId,
      anchorItems: { create: anchorData },
      contracts: { create: contractData },
    },
    update: {
      passwordHash,
      hourlyRateCents: body.hourlyRateCents,
      penaltyRateCentsPerMin: perMinuteRateCents(body.hourlyRateCents),
      dailyFreeMinutes: body.dailyFreeMinutes,
      ...(body.sessionCapCents !== undefined ? { sessionCapCents: body.sessionCapCents } : {}),
      anchorItems: { deleteMany: {}, create: anchorData },
      contracts: { create: contractData },
    },
    include: {
      contracts: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  // Mint the web session JWT so the dashboard can request a device-link OTP.
  // (Phase 1 enabling wiring — additive; no existing onboarding logic changed.)
  const res = NextResponse.json({
    userId: user.id,
    penaltyRateCentsPerMin: user.penaltyRateCentsPerMin,
    contractId: user.contracts[0].id,
    lockinEndsAt: user.contracts[0].lockinEndsAt,
  });
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
