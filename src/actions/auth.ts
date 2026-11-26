"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { copyTemplateToTenant } from "@/lib/defaults";
import { logAudit } from "@/lib/audit";

export type AuthState = { error?: string };

const RATE_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_ATTEMPT_LIMIT = 8;
const IP_ATTEMPT_LIMIT = 30;

async function clientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip")?.trim() || null;
}

async function countRecentAttempts(key: string): Promise<number> {
  return prisma.loginAttempt.count({
    where: { key, createdAt: { gte: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
}

async function recordFailedAttempt(keys: string[]): Promise<void> {
  await prisma.loginAttempt.createMany({ data: keys.map((key) => ({ key })) });
  await prisma.loginAttempt.deleteMany({
    where: { key: { in: keys }, createdAt: { lt: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const emailKey = `email:${email}`;
  const ip = await clientIp();
  const keys = ip ? [emailKey, `ip:${ip}`] : [emailKey];

  const attempts = await Promise.all(keys.map((key) => countRecentAttempts(key)));
  const emailAttempts = attempts[0] ?? 0;
  const ipAttempts = keys.length > 1 ? attempts[1] ?? 0 : 0;

  if (emailAttempts >= EMAIL_ATTEMPT_LIMIT || ipAttempts >= IP_ATTEMPT_LIMIT) {
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await recordFailedAttempt(keys);
    return { error: "Invalid email or password." };
  }

  await prisma.loginAttempt.deleteMany({ where: { key: { in: keys } } });
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RATE_WINDOW_MS) } },
  });

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function acceptInviteAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get("token") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();

  if (!token) return { error: "Missing invite token." };
  if (name.length < 2) return { error: "Enter your name." };
  if (password.length < 8) return { error: "Use a password with at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { tenant: true },
  });

  if (!invite || invite.status !== "pending") {
    return { error: "This invite is no longer valid." };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return { error: "This invite has expired. Ask the owner for a new one." };
  }

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) {
    return { error: "An account with this email already exists. Sign in instead." };
  }

  const passwordHash = await hashPassword(password);
  let userId = "";

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: invite.email, name, passwordHash },
    });
    userId = user.id;

    const tenant = await tx.tenant.create({
      data: {
        name: workspaceName || `${name.split(" ")[0]}'s Workspace`,
        currency: invite.tenant.currency,
      },
    });

    // Each invitee owns their own isolated workspace and can invite others.
    await tx.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: "owner" },
    });

    await copyTemplateToTenant(tx, invite.tenantId, tenant.id);

    await tx.invite.update({
      where: { id: invite.id },
      data: { status: "accepted", acceptedAt: new Date(), acceptedUserId: user.id },
    });

    await logAudit(tx, {
      tenantId: tenant.id,
      userId: user.id,
      action: "tenant.created",
      entity: "tenant",
      entityId: tenant.id,
      detail: `Joined via invite from ${invite.tenant.name}.`,
    });
  });

  await createSession(userId);
  redirect("/");
}
