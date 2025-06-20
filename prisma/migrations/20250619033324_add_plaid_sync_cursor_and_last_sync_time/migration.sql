-- AlterTable
ALTER TABLE "Account" ADD COLUMN "lastSyncTime" DATETIME;
ALTER TABLE "Account" ADD COLUMN "plaidSyncCursor" TEXT;
