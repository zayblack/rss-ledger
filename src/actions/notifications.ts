"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.notification.updateMany({
    where: {
      id,
      tenantId: session.tenant.id,
      OR: [{ userId: session.user.id }, { userId: null }],
    },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: {
      tenantId: session.tenant.id,
      readAt: null,
      OR: [{ userId: session.user.id }, { userId: null }],
    },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}