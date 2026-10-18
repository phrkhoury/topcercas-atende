-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyName" TEXT NOT NULL,
    "assistantName" TEXT NOT NULL,
    "knowledge" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "workDays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "workStart" TEXT NOT NULL DEFAULT '08:00',
    "workEnd" TEXT NOT NULL DEFAULT '17:00',
    "visitMinutes" INTEGER NOT NULL DEFAULT 60,
    "services" TEXT NOT NULL DEFAULT '',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("aiEnabled", "assistantName", "companyName", "id", "instructions", "knowledge", "updatedAt", "visitMinutes", "workDays", "workEnd", "workStart") SELECT "aiEnabled", "assistantName", "companyName", "id", "instructions", "knowledge", "updatedAt", "visitMinutes", "workDays", "workEnd", "workStart" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

