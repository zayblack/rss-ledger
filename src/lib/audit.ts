import type { Prisma } from "@prisma/client";

type AuditInput = {
  tenantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string | null;
};

export async function logAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      detail: input.detail ?? null,
    },
  });
}
