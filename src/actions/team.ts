"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { requireLimit, EntitlementError } from "@/lib/entitlements";

export type InviteState = {
  error?: string;
  success?: string;
  link?: string;
  email?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const session = await requireOwner();
  const tenantId = session.tenant.id;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const tenantName = String(formData.get("tenantName") ?? "").trim();

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return { error: "That email already has an account." };

  // Entitlement: member cap.
  try {
    const count = await prisma.membership.count({ where: { tenantId } });
    requireLimit(session.tenant.plan, "members", count);
  } catch (err) {
    if (err instanceof EntitlementError) return { error: err.message };
    throw err;
  }

  const existing = await prisma.invite.findFirst({
    where: { tenantId, email, status: "pending", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  let token = existing?.token;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    await prisma.invite.create({
      data: {
        tenantId,
        email,
        token,
        tenantName: tenantName || null,
        createdById: session.user.id,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: session.user.id,
        action: "invite.created",
        entity: "invite",
        detail: email,
      },
    });
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = `${proto}://${host}/accept-invite/${token}`;

  revalidatePath("/team");
  return {
    success: existing
      ? "That invite is still pending — here is the link again."
      : "Invite created. Share the link with the seller.",
    link,
    email,
  };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const session = await requireOwner();
  const id = String(formData.get("id") ?? "");

  await prisma.invite.updateMany({
    where: { id, tenantId: session.tenant.id, status: "pending" },
    data: { status: "revoked" },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "invite.revoked",
      entity: "invite",
      entityId: id,
    },
  });

  revalidatePath("/team");
}
