-- AlterTable
-- Nullable: accounts that predate password auth have none, and are asked to
-- set one the next time they onboard. A NOT NULL column would lock them out.
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;
