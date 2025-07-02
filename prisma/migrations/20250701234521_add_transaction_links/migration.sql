-- CreateTable
CREATE TABLE "TransactionLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransactionLink_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TransactionLink_entityType_entityId_idx" ON "TransactionLink"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "TransactionLink_transactionId_idx" ON "TransactionLink"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionLink_createdAt_idx" ON "TransactionLink"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionLink_transactionId_entityType_entityId_key" ON "TransactionLink"("transactionId", "entityType", "entityId");
