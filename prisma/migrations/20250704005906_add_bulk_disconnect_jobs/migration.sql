-- DropIndex
DROP INDEX "TransactionLink_createdAt_idx";

-- CreateTable
CREATE TABLE "BulkDisconnectJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputTokens" TEXT NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "reportPath" TEXT
);

-- CreateTable
CREATE TABLE "BulkDisconnectResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BulkDisconnectResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BulkDisconnectJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BulkDisconnectJob_createdAt_idx" ON "BulkDisconnectJob"("createdAt");

-- CreateIndex
CREATE INDEX "BulkDisconnectResult_jobId_idx" ON "BulkDisconnectResult"("jobId");

-- CreateIndex
CREATE INDEX "BulkDisconnectResult_accessToken_idx" ON "BulkDisconnectResult"("accessToken");
