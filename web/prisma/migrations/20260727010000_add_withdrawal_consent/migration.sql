-- Explicit consent to immediate performance during the statutory withdrawal
-- period, recorded separately from general ToS acceptance.
--
-- Nullable on purpose: contracts signed before this shipped genuinely do NOT
-- carry this consent, and backfilling a timestamp would fabricate evidence.
-- NULL here means "not obtained" and should be read that way.

-- AlterTable
ALTER TABLE "CommitmentContract" ADD COLUMN     "withdrawalConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommitmentContract" ADD COLUMN     "withdrawalTermsVersion" TEXT;
