-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnomalyDetectionResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settingsId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnomalyDetectionResult_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnomalyDetectionResult_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "AnomalyDetectionSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AnomalyDetectionResult" ("createdAt", "id", "isResolved", "metadata", "reason", "resolvedAt", "resolvedBy", "settingsId", "severity", "transactionId", "type") SELECT "createdAt", "id", "isResolved", "metadata", "reason", "resolvedAt", "resolvedBy", "settingsId", "severity", "transactionId", "type" FROM "AnomalyDetectionResult";
DROP TABLE "AnomalyDetectionResult";
ALTER TABLE "new_AnomalyDetectionResult" RENAME TO "AnomalyDetectionResult";
CREATE INDEX "AnomalyDetectionResult_settingsId_idx" ON "AnomalyDetectionResult"("settingsId");
CREATE INDEX "AnomalyDetectionResult_transactionId_idx" ON "AnomalyDetectionResult"("transactionId");
CREATE INDEX "AnomalyDetectionResult_severity_idx" ON "AnomalyDetectionResult"("severity");
CREATE INDEX "AnomalyDetectionResult_isResolved_idx" ON "AnomalyDetectionResult"("isResolved");
CREATE INDEX "AnomalyDetectionResult_isHidden_idx" ON "AnomalyDetectionResult"("isHidden");
CREATE INDEX "AnomalyDetectionResult_createdAt_idx" ON "AnomalyDetectionResult"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
