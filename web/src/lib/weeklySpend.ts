import { prisma } from '@/lib/prisma';
import { localWeekStart } from '@/lib/localDay';

/**
 * What this week has already cost the user, in cents.
 *
 * Counts every way money leaves: the burn on any session that ended this week,
 * plus purgatory that has been captured or is still on hold. Purgatory on hold
 * counts as spent because it is at risk right now — a cap that ignored it
 * could let a week finish owing far more than the number the user agreed to,
 * which would make the cap a decoration.
 *
 * Purgatory that was walked off (RELEASED) does not count. It never left.
 */
export async function weeklySpentCents(userId: string, timeZone: string, now = new Date()) {
  const weekStart = localWeekStart(now, timeZone);

  const sessions = await prisma.session.findMany({
    where: { userId, endTime: { gte: weekStart } },
    select: { status: true, burnCents: true, purgatoryCents: true },
  });

  return sessions.reduce((total, s) => {
    // RELEASED still burned its 20%; only the purgatory came back.
    const atRisk = s.status === 'HOLD' || s.status === 'CAPTURED' || s.status === 'CHARGE_FAILED';
    return total + s.burnCents + (atRisk ? s.purgatoryCents : 0);
  }, 0);
}
