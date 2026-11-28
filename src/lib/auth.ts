import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const SESSION_COOKIE = "rl_session";
const SESSION_DAYS = 30;

export type SessionContext = {
  user: { id: string; email: string; name: string; isPlatformAdmin: boolean };
  tenant: { id: string; name: string; currency: string; plan: string; theme: string; themeAccent: string | null };
  membership: { id: string; role: string };
  sessionId: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  jar.delete(SESSION_COOKIE);
}

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          memberships: {
            include: { tenant: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const membership = session.user.memberships[0];
  if (!membership) return null;

  // Enforce subscription expiry: an expired paid plan reverts to basic.
  let plan = membership.tenant.plan;
  const expiresAt = membership.tenant.subscriptionExpiresAt;
  if (expiresAt && expiresAt.getTime() < Date.now() && plan !== "basic") {
    await prisma.tenant
      .updateMany({
        where: {
          id: membership.tenant.id,
          subscriptionExpiresAt: { lt: new Date() },
          plan: { not: "basic" },
        },
        data: { plan: "basic", subscriptionStatus: "expired" },
      })
      .catch(() => undefined);
    plan = "basic";
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      isPlatformAdmin: session.user.isPlatformAdmin,
    },
    tenant: {
      id: membership.tenant.id,
      name: membership.tenant.name,
      currency: membership.tenant.currency,
      plan,
      theme: membership.tenant.theme,
      themeAccent: membership.tenant.themeAccent,
    },
    membership: { id: membership.id, role: membership.role },
    sessionId: session.id,
  };
});

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireOwner(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.membership.role !== "owner") redirect("/");
  return session;
}

export async function requireManager(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.membership.role !== "owner" && session.membership.role !== "manager") {
    redirect("/");
  }
  return session;
}
