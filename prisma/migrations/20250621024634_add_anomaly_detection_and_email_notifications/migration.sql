-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnomalyDetectionSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "minAmount" REAL NOT NULL DEFAULT 50,
    "maxAmount" REAL NOT NULL DEFAULT 10000,
    "timeWindow" INTEGER NOT NULL DEFAULT 30,
    "zScoreThreshold" REAL NOT NULL DEFAULT 2.5,
    "newMerchantThreshold" REAL NOT NULL DEFAULT 100,
    "geographicThreshold" REAL NOT NULL DEFAULT 50,
    "hoursWindow" INTEGER NOT NULL DEFAULT 24,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "emailFrequency" TEXT NOT NULL DEFAULT 'daily',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnomalyDetectionSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnomalyDetectionResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settingsId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnomalyDetectionResult_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "AnomalyDetectionSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnomalyDetectionResult_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "plaidId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "mask" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "url" TEXT,
    "invertTransactions" BOOLEAN NOT NULL DEFAULT false,
    "itemId" TEXT NOT NULL,
    "plaidSyncCursor" TEXT,
    "lastSyncTime" DATETIME,
    "lastStatementBalance" REAL,
    "minimumPaymentAmount" REAL,
    "nextPaymentDueDate" DATETIME,
    "lastPaymentDate" DATETIME,
    "lastPaymentAmount" REAL,
    "nextMonthlyPayment" REAL,
    "originationDate" DATETIME,
    "originationPrincipalAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaidItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("createdAt", "hidden", "id", "invertTransactions", "itemId", "lastPaymentAmount", "lastPaymentDate", "lastStatementBalance", "lastSyncTime", "mask", "metadata", "minimumPaymentAmount", "name", "nextMonthlyPayment", "nextPaymentDueDate", "nickname", "originationDate", "originationPrincipalAmount", "plaidId", "plaidSyncCursor", "subtype", "type", "updatedAt", "url") SELECT "createdAt", "hidden", "id", "invertTransactions", "itemId", "lastPaymentAmount", "lastPaymentDate", "lastStatementBalance", "lastSyncTime", "mask", "metadata", "minimumPaymentAmount", "name", "nextMonthlyPayment", "nextPaymentDueDate", "nickname", "originationDate", "originationPrincipalAmount", "plaidId", "plaidSyncCursor", "subtype", "type", "updatedAt", "url" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_plaidId_key" ON "Account"("plaidId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AnomalyDetectionSettings_userId_key" ON "AnomalyDetectionSettings"("userId");

-- CreateIndex
CREATE INDEX "AnomalyDetectionResult_settingsId_idx" ON "AnomalyDetectionResult"("settingsId");

-- CreateIndex
CREATE INDEX "AnomalyDetectionResult_transactionId_idx" ON "AnomalyDetectionResult"("transactionId");

-- CreateIndex
CREATE INDEX "AnomalyDetectionResult_severity_idx" ON "AnomalyDetectionResult"("severity");

-- CreateIndex
CREATE INDEX "AnomalyDetectionResult_isResolved_idx" ON "AnomalyDetectionResult"("isResolved");

-- CreateIndex
CREATE INDEX "AnomalyDetectionResult_createdAt_idx" ON "AnomalyDetectionResult"("createdAt");

-- CreateIndex
CREATE INDEX "EmailNotification_userId_idx" ON "EmailNotification"("userId");

-- CreateIndex
CREATE INDEX "EmailNotification_status_idx" ON "EmailNotification"("status");

-- CreateIndex
CREATE INDEX "EmailNotification_createdAt_idx" ON "EmailNotification"("createdAt");
