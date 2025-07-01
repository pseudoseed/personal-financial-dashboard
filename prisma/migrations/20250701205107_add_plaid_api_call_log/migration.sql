-- CreateTable
CREATE TABLE "PlaidApiCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpoint" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "institutionId" TEXT,
    "accountId" TEXT,
    "userId" TEXT,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "appInstanceId" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmergencyFundAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmergencyFundAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmergencyFundAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmergencyFundAccount" ("accountId", "id", "userId") SELECT "accountId", "id", "userId" FROM "EmergencyFundAccount";
DROP TABLE "EmergencyFundAccount";
ALTER TABLE "new_EmergencyFundAccount" RENAME TO "EmergencyFundAccount";
CREATE UNIQUE INDEX "EmergencyFundAccount_userId_accountId_key" ON "EmergencyFundAccount"("userId", "accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PlaidApiCallLog_timestamp_idx" ON "PlaidApiCallLog"("timestamp");

-- CreateIndex
CREATE INDEX "PlaidApiCallLog_endpoint_idx" ON "PlaidApiCallLog"("endpoint");

-- CreateIndex
CREATE INDEX "PlaidApiCallLog_institutionId_idx" ON "PlaidApiCallLog"("institutionId");

-- CreateIndex
CREATE INDEX "PlaidApiCallLog_responseStatus_idx" ON "PlaidApiCallLog"("responseStatus");
