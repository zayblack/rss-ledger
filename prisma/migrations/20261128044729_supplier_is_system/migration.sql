-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shareBps" INTEGER NOT NULL DEFAULT 5000,
    "shareBasis" TEXT NOT NULL DEFAULT 'gross',
    "contact" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Supplier" ("archived", "contact", "createdAt", "id", "name", "notes", "shareBasis", "shareBps", "tenantId") SELECT "archived", "contact", "createdAt", "id", "name", "notes", "shareBasis", "shareBps", "tenantId" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");
CREATE UNIQUE INDEX "Supplier_tenantId_name_key" ON "Supplier"("tenantId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
