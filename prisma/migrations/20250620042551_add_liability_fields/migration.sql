-- AlterTable
ALTER TABLE "Account" ADD COLUMN "lastPaymentAmount" REAL;
ALTER TABLE "Account" ADD COLUMN "lastPaymentDate" DATETIME;
ALTER TABLE "Account" ADD COLUMN "lastStatementBalance" REAL;
ALTER TABLE "Account" ADD COLUMN "minimumPaymentAmount" REAL;
ALTER TABLE "Account" ADD COLUMN "nextMonthlyPayment" REAL;
ALTER TABLE "Account" ADD COLUMN "nextPaymentDueDate" DATETIME;
ALTER TABLE "Account" ADD COLUMN "originationDate" DATETIME;
ALTER TABLE "Account" ADD COLUMN "originationPrincipalAmount" REAL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "categoryAi" TEXT;
