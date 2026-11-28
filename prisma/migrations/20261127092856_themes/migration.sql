-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'Credits',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "subscriptionExpiresAt" DATETIME,
    "billingProvider" TEXT,
    "billingCustomerId" TEXT,
    "billingSubscriptionId" TEXT,
    "salesThisMonth" INTEGER NOT NULL DEFAULT 0,
    "monthResetAt" DATETIME,
    "purgeAfter" DATETIME,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "themeAccent" TEXT
);
INSERT INTO "new_Tenant" ("billingCustomerId", "billingProvider", "billingSubscriptionId", "createdAt", "currency", "id", "monthResetAt", "name", "plan", "purgeAfter", "salesThisMonth", "subscriptionExpiresAt", "subscriptionStatus") SELECT "billingCustomerId", "billingProvider", "billingSubscriptionId", "createdAt", "currency", "id", "monthResetAt", "name", "plan", "purgeAfter", "salesThisMonth", "subscriptionExpiresAt", "subscriptionStatus" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
