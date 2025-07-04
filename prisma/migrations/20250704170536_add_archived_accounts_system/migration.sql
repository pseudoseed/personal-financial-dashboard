-- CreateTable
CREATE TABLE "ArchivedTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalAccountId" TEXT NOT NULL,
    "originalTransactionId" TEXT NOT NULL,
    "plaidId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "category" TEXT,
    "merchantName" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fees" REAL,
    "isoCurrencyCode" TEXT,
    "price" REAL,
    "quantity" REAL,
    "securityId" TEXT,
    "subtype" TEXT,
    "tickerSymbol" TEXT,
    "type" TEXT,
    "authorizedDate" DATETIME,
    "authorizedDatetime" DATETIME,
    "byOrderOf" TEXT,
    "closePrice" REAL,
    "closePriceAsOf" DATETIME,
    "cusip" TEXT,
    "datetime" DATETIME,
    "industry" TEXT,
    "institutionSecurityId" TEXT,
    "isCashEquivalent" BOOLEAN,
    "isin" TEXT,
    "locationAddress" TEXT,
    "locationCity" TEXT,
    "locationCountry" TEXT,
    "locationLat" REAL,
    "locationLon" REAL,
    "locationPostalCode" TEXT,
    "locationRegion" TEXT,
    "marketIdentifierCode" TEXT,
    "merchantEntityId" TEXT,
    "payee" TEXT,
    "payer" TEXT,
    "paymentChannel" TEXT,
    "paymentMethod" TEXT,
    "paymentProcessor" TEXT,
    "personalFinanceCategory" TEXT,
    "ppd_id" TEXT,
    "reason" TEXT,
    "referenceNumber" TEXT,
    "sector" TEXT,
    "securityName" TEXT,
    "securityType" TEXT,
    "sedol" TEXT,
    "transactionCode" TEXT,
    "unofficialCurrencyCode" TEXT,
    "categoryAiGranular" TEXT,
    "categoryAiGeneral" TEXT,
    "categoryPlaidGranular" TEXT,
    "categoryPlaidGeneral" TEXT
);

-- CreateTable
CREATE TABLE "ArchivedAccountBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalAccountId" TEXT NOT NULL,
    "originalBalanceId" TEXT NOT NULL,
    "current" REAL NOT NULL,
    "available" REAL,
    "limit" REAL,
    "date" DATETIME NOT NULL,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "archived" BOOLEAN NOT NULL DEFAULT false,
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
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Account_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaidItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("createdAt", "hidden", "id", "invertTransactions", "itemId", "lastPaymentAmount", "lastPaymentDate", "lastStatementBalance", "lastSyncTime", "mask", "metadata", "minimumPaymentAmount", "name", "nextMonthlyPayment", "nextPaymentDueDate", "nickname", "originationDate", "originationPrincipalAmount", "plaidId", "plaidSyncCursor", "subtype", "type", "updatedAt", "url", "userId") SELECT "createdAt", "hidden", "id", "invertTransactions", "itemId", "lastPaymentAmount", "lastPaymentDate", "lastStatementBalance", "lastSyncTime", "mask", "metadata", "minimumPaymentAmount", "name", "nextMonthlyPayment", "nextPaymentDueDate", "nickname", "originationDate", "originationPrincipalAmount", "plaidId", "plaidSyncCursor", "subtype", "type", "updatedAt", "url", "userId" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_plaidId_key" ON "Account"("plaidId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ArchivedTransaction_originalAccountId_idx" ON "ArchivedTransaction"("originalAccountId");

-- CreateIndex
CREATE INDEX "ArchivedTransaction_date_idx" ON "ArchivedTransaction"("date");

-- CreateIndex
CREATE INDEX "ArchivedTransaction_archivedAt_idx" ON "ArchivedTransaction"("archivedAt");

-- CreateIndex
CREATE INDEX "ArchivedAccountBalance_originalAccountId_idx" ON "ArchivedAccountBalance"("originalAccountId");

-- CreateIndex
CREATE INDEX "ArchivedAccountBalance_date_idx" ON "ArchivedAccountBalance"("date");

-- CreateIndex
CREATE INDEX "ArchivedAccountBalance_archivedAt_idx" ON "ArchivedAccountBalance"("archivedAt");
