-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoanDetails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "originalAmount" REAL,
    "currentBalance" REAL,
    "startDate" DATETIME,
    "paymentsMade" REAL,
    "currentInterestRate" REAL,
    "currentInterestRateSource" TEXT NOT NULL DEFAULT 'plaid',
    "introductoryRate" REAL,
    "introductoryRateSource" TEXT NOT NULL DEFAULT 'plaid',
    "introductoryRateExpiry" DATETIME,
    "introductoryRateExpirySource" TEXT NOT NULL DEFAULT 'plaid',
    "rateType" TEXT,
    "paymentsPerMonth" INTEGER NOT NULL DEFAULT 1,
    "paymentsPerMonthSource" TEXT NOT NULL DEFAULT 'manual',
    "paymentsRemaining" INTEGER,
    "paymentsRemainingSource" TEXT NOT NULL DEFAULT 'calculated',
    "paymentsRemainingDate" DATETIME,
    "autoCalculatePayments" BOOLEAN NOT NULL DEFAULT true,
    "lastCalculationDate" DATETIME,
    "loanType" TEXT,
    "loanTerm" INTEGER,
    "gracePeriod" INTEGER,
    "lastPlaidSync" DATETIME,
    "plaidDataFields" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "balanceOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideDate" DATETIME,
    CONSTRAINT "LoanDetails_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoanDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LoanDetails" ("accountId", "autoCalculatePayments", "createdAt", "currentBalance", "currentInterestRate", "currentInterestRateSource", "gracePeriod", "id", "introductoryRate", "introductoryRateExpiry", "introductoryRateExpirySource", "introductoryRateSource", "lastCalculationDate", "lastPlaidSync", "loanTerm", "loanType", "originalAmount", "paymentsMade", "paymentsPerMonth", "paymentsPerMonthSource", "paymentsRemaining", "paymentsRemainingDate", "paymentsRemainingSource", "plaidDataFields", "rateType", "startDate", "updatedAt", "userId") SELECT "accountId", "autoCalculatePayments", "createdAt", "currentBalance", "currentInterestRate", "currentInterestRateSource", "gracePeriod", "id", "introductoryRate", "introductoryRateExpiry", "introductoryRateExpirySource", "introductoryRateSource", "lastCalculationDate", "lastPlaidSync", "loanTerm", "loanType", "originalAmount", "paymentsMade", "paymentsPerMonth", "paymentsPerMonthSource", "paymentsRemaining", "paymentsRemainingDate", "paymentsRemainingSource", "plaidDataFields", "rateType", "startDate", "updatedAt", "userId" FROM "LoanDetails";
DROP TABLE "LoanDetails";
ALTER TABLE "new_LoanDetails" RENAME TO "LoanDetails";
CREATE UNIQUE INDEX "LoanDetails_accountId_key" ON "LoanDetails"("accountId");
CREATE INDEX "LoanDetails_userId_idx" ON "LoanDetails"("userId");
CREATE INDEX "LoanDetails_introductoryRateExpiry_idx" ON "LoanDetails"("introductoryRateExpiry");
CREATE INDEX "LoanDetails_lastPlaidSync_idx" ON "LoanDetails"("lastPlaidSync");
CREATE INDEX "LoanDetails_paymentsRemainingDate_idx" ON "LoanDetails"("paymentsRemainingDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
