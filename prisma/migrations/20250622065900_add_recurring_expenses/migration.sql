-- CreateTable
CREATE TABLE "AnomalyDismissalRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "ruleValue" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnomalyDismissalRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "category" TEXT,
    "amount" REAL NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextDueDate" DATETIME,
    "lastTransactionDate" DATETIME NOT NULL,
    "confidence" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringExpenseTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recurringExpenseId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringExpenseTransaction_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpenseTransaction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AnomalyDismissalRule_userId_idx" ON "AnomalyDismissalRule"("userId");

-- CreateIndex
CREATE INDEX "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");

-- CreateIndex
CREATE INDEX "RecurringExpense_merchantName_idx" ON "RecurringExpense"("merchantName");

-- CreateIndex
CREATE INDEX "RecurringExpense_isActive_idx" ON "RecurringExpense"("isActive");

-- CreateIndex
CREATE INDEX "RecurringExpense_isConfirmed_idx" ON "RecurringExpense"("isConfirmed");

-- CreateIndex
CREATE INDEX "RecurringExpenseTransaction_recurringExpenseId_idx" ON "RecurringExpenseTransaction"("recurringExpenseId");

-- CreateIndex
CREATE INDEX "RecurringExpenseTransaction_transactionId_idx" ON "RecurringExpenseTransaction"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringExpenseTransaction_recurringExpenseId_transactionId_key" ON "RecurringExpenseTransaction"("recurringExpenseId", "transactionId");
