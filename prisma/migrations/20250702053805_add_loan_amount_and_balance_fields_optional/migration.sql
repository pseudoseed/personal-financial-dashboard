-- AlterTable
ALTER TABLE "LoanDetails" ADD COLUMN "currentBalance" REAL;
ALTER TABLE "LoanDetails" ADD COLUMN "originalAmount" REAL;
ALTER TABLE "LoanDetails" ADD COLUMN "paymentsMade" REAL;
ALTER TABLE "LoanDetails" ADD COLUMN "startDate" DATETIME;
