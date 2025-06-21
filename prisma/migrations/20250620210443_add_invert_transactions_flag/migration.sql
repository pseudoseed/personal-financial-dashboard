-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Account_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaidItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("createdAt", "hidden", "id", "itemId", "lastPaymentAmount", "lastPaymentDate", "lastStatementBalance", "lastSyncTime", "mask", "metadata", "minimumPaymentAmount", "name", "nextMonthlyPayment", "nextPaymentDueDate", "nickname", "originationDate", "originationPrincipalAmount", "plaidId", "plaidSyncCursor", "subtype", "type", "updatedAt", "url") SELECT "createdAt", "hidden", "id", "itemId", "lastPaymentAmount", "lastPaymentDate", "lastStatementBalance", "lastSyncTime", "mask", "metadata", "minimumPaymentAmount", "name", "nextMonthlyPayment", "nextPaymentDueDate", "nickname", "originationDate", "originationPrincipalAmount", "plaidId", "plaidSyncCursor", "subtype", "type", "updatedAt", "url" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_plaidId_key" ON "Account"("plaidId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
