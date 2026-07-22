import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDevice } from '@/lib/deviceAuth';

const bodySchema = z.object({
  // Total steps for `day` so far, as read from Health Connect. Cumulative
  // through the day — we keep the max seen, so out-of-order syncs are harmless.
  steps: z.number().int().min(0),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // device-local calendar day
  source: z.string().max(32).optional(),
});

/**
 * POST /api/device/steps
 * Device-authenticated (Phase 1). The Android HealthSyncWorker pushes the
 * day's running step total here; the nightly /api/jobs/evaluate-steps cron
 * reads it. Upserts (userId, day) taking the max step count.
 */
export async function POST(req: Request) {
  const auth = await requireDevice(req);
  if (auth instanceof NextResponse) return auth;

  const body = bodySchema.parse(await req.json());
  const day = new Date(`${body.day}T00:00:00.000Z`);

  const existing = await prisma.dailyActivity.findUnique({
    where: { userId_day: { userId: auth.userId, day } },
    select: { steps: true },
  });
  const steps = Math.max(existing?.steps ?? 0, body.steps);

  await prisma.dailyActivity.upsert({
    where: { userId_day: { userId: auth.userId, day } },
    create: { userId: auth.userId, day, steps, source: body.source },
    update: { steps, source: body.source },
  });

  return NextResponse.json({ ok: true, steps });
}
