-- CreateTable
CREATE TABLE "RecurringPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextPaymentDate" DATETIME NOT NULL,
    "lastPaymentDate" DATETIME,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "paymentType" TEXT NOT NULL,
    "targetAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confidence" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringPayment_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecurringPayment_userId_idx" ON "RecurringPayment"("userId");

-- CreateIndex
CREATE INDEX "RecurringPayment_isActive_idx" ON "RecurringPayment"("isActive");

-- CreateIndex
CREATE INDEX "RecurringPayment_isConfirmed_idx" ON "RecurringPayment"("isConfirmed");

-- CreateIndex
CREATE INDEX "RecurringPayment_nextPaymentDate_idx" ON "RecurringPayment"("nextPaymentDate");

-- CreateIndex
CREATE INDEX "RecurringPayment_targetAccountId_idx" ON "RecurringPayment"("targetAccountId");
