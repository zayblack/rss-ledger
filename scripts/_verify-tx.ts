import { prisma } from "../src/lib/db";
import { notify } from "../src/lib/notifications";

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow();
  const started = Date.now();
  const result = await prisma.$transaction(
    async (tx) => {
      await notify({ tenantId: tenant.id, type: "test", title: "inside tx" }, tx);
      return "committed";
    },
    { timeout: 5000 },
  );
  const count = await prisma.notification.count({
    where: { tenantId: tenant.id, type: "test" },
  });
  console.log(JSON.stringify({ result, count, ms: Date.now() - started }));
  await prisma.notification.deleteMany({ where: { tenantId: tenant.id, type: "test" } });
}

main().finally(() => prisma.$disconnect());
