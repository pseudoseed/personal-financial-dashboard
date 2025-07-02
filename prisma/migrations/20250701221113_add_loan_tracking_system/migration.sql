-- CreateTable
CREATE TABLE "LoanDetails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
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
    CONSTRAINT "LoanDetails_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoanDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoanPaymentHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoanPaymentHistory_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LoanDetails" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoanAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoanAlert_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LoanDetails" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanDetails_accountId_key" ON "LoanDetails"("accountId");

-- CreateIndex
CREATE INDEX "LoanDetails_userId_idx" ON "LoanDetails"("userId");

-- CreateIndex
CREATE INDEX "LoanDetails_introductoryRateExpiry_idx" ON "LoanDetails"("introductoryRateExpiry");

-- CreateIndex
CREATE INDEX "LoanDetails_lastPlaidSync_idx" ON "LoanDetails"("lastPlaidSync");

-- CreateIndex
CREATE INDEX "LoanDetails_paymentsRemainingDate_idx" ON "LoanDetails"("paymentsRemainingDate");

-- CreateIndex
CREATE INDEX "LoanPaymentHistory_loanId_idx" ON "LoanPaymentHistory"("loanId");

-- CreateIndex
CREATE INDEX "LoanPaymentHistory_paymentDate_idx" ON "LoanPaymentHistory"("paymentDate");

-- CreateIndex
CREATE INDEX "LoanAlert_loanId_idx" ON "LoanAlert"("loanId");

-- CreateIndex
CREATE INDEX "LoanAlert_alertType_idx" ON "LoanAlert"("alertType");

-- CreateIndex
CREATE INDEX "LoanAlert_isActive_idx" ON "LoanAlert"("isActive");

-- CreateIndex
CREATE INDEX "LoanAlert_severity_idx" ON "LoanAlert"("severity");
