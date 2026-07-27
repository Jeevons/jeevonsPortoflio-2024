-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recoveryCodes" JSONB,
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpSecret" TEXT;
