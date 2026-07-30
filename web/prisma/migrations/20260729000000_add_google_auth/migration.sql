-- AlterTable
-- Nullable: email+password stays an opt-in alternative, so a user may have
-- either credential or (after linking) both.
ALTER TABLE "User" ADD COLUMN     "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
