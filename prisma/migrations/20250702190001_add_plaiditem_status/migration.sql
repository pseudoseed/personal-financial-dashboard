-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlaidItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'plaid',
    "institutionId" TEXT NOT NULL,
    "institutionName" TEXT,
    "institutionLogo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active'
);
INSERT INTO "new_PlaidItem" ("accessToken", "createdAt", "id", "institutionId", "institutionLogo", "institutionName", "itemId", "provider", "refreshToken", "updatedAt") SELECT "accessToken", "createdAt", "id", "institutionId", "institutionLogo", "institutionName", "itemId", "provider", "refreshToken", "updatedAt" FROM "PlaidItem";
DROP TABLE "PlaidItem";
ALTER TABLE "new_PlaidItem" RENAME TO "PlaidItem";
CREATE UNIQUE INDEX "PlaidItem_itemId_key" ON "PlaidItem"("itemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
