-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyStepGoal" INTEGER NOT NULL DEFAULT 8000,
ADD COLUMN     "lazinessPenaltyCents" INTEGER NOT NULL DEFAULT 200;

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "penaltyEvaluatedAt" TIMESTAMP(3),
    "penaltyChargeCents" INTEGER,
    "stripePenaltyPaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_stripePenaltyPaymentIntentId_key" ON "DailyActivity"("stripePenaltyPaymentIntentId");

-- CreateIndex
CREATE INDEX "DailyActivity_day_penaltyEvaluatedAt_idx" ON "DailyActivity"("day", "penaltyEvaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_userId_day_key" ON "DailyActivity"("userId", "day");

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

