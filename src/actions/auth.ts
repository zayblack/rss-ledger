"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { copyTemplateToTenant } from "@/lib/defaults";
import { logAudit } from "@/lib/audit";

export type AuthState = { error?: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }

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

    await tx.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: "seller" },
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
