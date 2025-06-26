-- CreateTable
CREATE TABLE "FinancialHealthMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "emergencyFundRatio" REAL,
    "debtToIncomeRatio" REAL,
    "savingsRate" REAL,
    "creditUtilization" REAL,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialHealthMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FinancialHealthMetrics_userId_idx" ON "FinancialHealthMetrics"("userId");

-- CreateIndex
CREATE INDEX "FinancialHealthMetrics_calculatedAt_idx" ON "FinancialHealthMetrics"("calculatedAt");
