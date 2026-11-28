import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

type NotificationClient = Pick<Prisma.TransactionClient, "notification">;

/**
 * Writes a notification. Pass the active transaction client when calling from
 * inside `prisma.$transaction`, otherwise the write runs on a separate
 * connection and can deadlock (SQLite) or commit out of band (Postgres).
 */
export async function notify(
  params: {
    tenantId: string;
    userId?: string | null;
    type: string;
    title: string;
    body?: string | null;
  },
  client: NotificationClient = prisma,
): Promise<void> {
  await client.notification.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
    },
  });
}

export async function unreadCount(tenantId: string, userId: string): Promise<number> {
  return prisma.notification.count({
    where: { tenantId, OR: [{ userId }, { userId: null }], readAt: null },
  });
}
