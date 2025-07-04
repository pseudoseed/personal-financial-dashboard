/*
  Warnings:

  - You are about to drop the `ArchivedAccountBalance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ArchivedTransaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ArchivedAccountBalance";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ArchivedTransaction";
PRAGMA foreign_keys=on;
