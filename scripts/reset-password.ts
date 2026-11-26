/**
 * Recover access without email infrastructure.
 *
 * Usage:
 *   npm run user:reset-password -- owner@example.com
 *
 * Generates a random password, updates the account, signs out every session,
 * and prints the new password once. Run it on the machine that hosts the app.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run user:reset-password -- <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  const password = randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.loginAttempt.deleteMany({ where: { key: `email:${email}` } });

    const membership = user.memberships[0];
    if (membership) {
      await tx.auditLog.create({
        data: {
          tenantId: membership.tenantId,
          userId: user.id,
          action: "password.reset.cli",
          entity: "user",
          entityId: user.id,
          detail: "Password reset from the command line.",
        },
      });
    }
  });

  console.log("");
  console.log(`Password reset for ${email}.`);
  console.log(`New password: ${password}`);
  console.log("");
  console.log("Sign in and change it in Settings → Security.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
