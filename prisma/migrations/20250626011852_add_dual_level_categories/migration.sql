/*
  Warnings:

  - You are about to drop the column `categoryAi` on the `Transaction` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "plaidId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "category" TEXT,
    "merchantName" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
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
    "categoryPlaidGeneral" TEXT,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountId", "amount", "authorizedDate", "authorizedDatetime", "byOrderOf", "category", "closePrice", "closePriceAsOf", "createdAt", "cusip", "date", "datetime", "fees", "id", "industry", "institutionSecurityId", "isCashEquivalent", "isin", "isoCurrencyCode", "locationAddress", "locationCity", "locationCountry", "locationLat", "locationLon", "locationPostalCode", "locationRegion", "marketIdentifierCode", "merchantEntityId", "merchantName", "name", "payee", "payer", "paymentChannel", "paymentMethod", "paymentProcessor", "pending", "personalFinanceCategory", "plaidId", "ppd_id", "price", "quantity", "reason", "referenceNumber", "sector", "securityId", "securityName", "securityType", "sedol", "subtype", "tickerSymbol", "transactionCode", "type", "unofficialCurrencyCode", "updatedAt") SELECT "accountId", "amount", "authorizedDate", "authorizedDatetime", "byOrderOf", "category", "closePrice", "closePriceAsOf", "createdAt", "cusip", "date", "datetime", "fees", "id", "industry", "institutionSecurityId", "isCashEquivalent", "isin", "isoCurrencyCode", "locationAddress", "locationCity", "locationCountry", "locationLat", "locationLon", "locationPostalCode", "locationRegion", "marketIdentifierCode", "merchantEntityId", "merchantName", "name", "payee", "payer", "paymentChannel", "paymentMethod", "paymentProcessor", "pending", "personalFinanceCategory", "plaidId", "ppd_id", "price", "quantity", "reason", "referenceNumber", "sector", "securityId", "securityName", "securityType", "sedol", "subtype", "tickerSymbol", "transactionCode", "type", "unofficialCurrencyCode", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE UNIQUE INDEX "Transaction_accountId_plaidId_key" ON "Transaction"("accountId", "plaidId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
