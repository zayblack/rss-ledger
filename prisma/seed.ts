import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedTenantDefaults } from "../src/lib/defaults";

const prisma = new PrismaClient();

const OWNER_EMAIL = process.env.SEED_EMAIL ?? "owner@example.com";
const OWNER_PASSWORD = process.env.SEED_PASSWORD ?? "ledger123";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (existing) {
    console.log(`Owner ${OWNER_EMAIL} already exists — nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: OWNER_EMAIL,
        name: "Workspace Owner",
        passwordHash,
        isPlatformAdmin: true,
      },
    });

    const tenant = await tx.tenant.create({
      data: { name: "My Trading Post", currency: "Credits", plan: "premium", subscriptionStatus: "active" },
    });

    await tx.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: "owner" },
    });

    await seedTenantDefaults(tx, tenant.id);

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        action: "tenant.seeded",
        entity: "tenant",
        entityId: tenant.id,
        detail: "Initial workspace created by seed script.",
      },
    });
  });

  console.log("");
  console.log("  StockLedger is ready.");
  console.log(`  Sign in: ${OWNER_EMAIL}`);
  console.log(`  Password: ${OWNER_PASSWORD}`);
  console.log("");
  console.log("  Change these in Settings after your first login.");
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
