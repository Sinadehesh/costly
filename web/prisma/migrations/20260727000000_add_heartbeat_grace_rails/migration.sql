-- Dead man's switch grace rails.
-- Both columns are nullable with no default, so this is safe on a live table:
-- existing users start with no warning sent and no pending breach, which is
-- exactly the correct initial state.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "heartbeatWarningSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommitmentContract" ADD COLUMN     "breachPendingSince" TIMESTAMP(3);
