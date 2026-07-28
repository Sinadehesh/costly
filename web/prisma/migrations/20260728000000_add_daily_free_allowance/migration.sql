-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyFreeMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
-- Existing sessions predate the split. Backfilling billableSeconds from
-- totalActiveSeconds keeps the invariant (freeSeconds + billableSeconds =
-- totalActiveSeconds) true for history: before this migration every detected
-- second was billable, because no free allowance existed.
ALTER TABLE "Session" ADD COLUMN     "billableSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freeSeconds" INTEGER NOT NULL DEFAULT 0;

UPDATE "Session" SET "billableSeconds" = "totalActiveSeconds";

-- CreateTable
CREATE TABLE "DailyMeter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMeter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyMeter_userId_idx" ON "DailyMeter"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMeter_userId_day_key" ON "DailyMeter"("userId", "day");

-- AddForeignKey
ALTER TABLE "DailyMeter" ADD CONSTRAINT "DailyMeter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
