-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "fees" REAL;
ALTER TABLE "Transaction" ADD COLUMN "isoCurrencyCode" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "price" REAL;
ALTER TABLE "Transaction" ADD COLUMN "quantity" REAL;
ALTER TABLE "Transaction" ADD COLUMN "securityId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "subtype" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "tickerSymbol" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "type" TEXT;
