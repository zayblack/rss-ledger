import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; page?: string }>;
}) {
  const session = await requireOwner();
  const tenantId = session.tenant.id;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const action = sp.action?.trim() || undefined;
  const entity = sp.entity?.trim() || undefined;

  const where = {
    tenantId,
    ...(action ? { action: { contains: action } } : {}),
    ...(entity ? { entity } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { tenant: false },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Resolve user names.
  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every mutation recorded for this workspace."
        actions={
          <Link href="/settings" className={buttonClass("ghost", "md")}>
            <ArrowLeft className="size-4" />
            Settings
          </Link>
        }
      />

      <Card className="mb-4">
        <CardBody className="pt-3">
          <form className="grid gap-3 sm:grid-cols-3" method="get">
            <Input name="action" defaultValue={action ?? ""} placeholder="Action contains…" />
            <Input name="entity" defaultValue={entity ?? ""} placeholder="Entity (e.g. sale)" />
            <Button type="submit" variant="secondary" size="sm">
              Filter
            </Button>
          </form>
        </CardBody>
      </Card>

      {logs.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="size-5" />}
          title="No audit entries"
          description="Mutations will appear here as you use the app."
        />
      ) : (
        <Card>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const u = log.userId ? userMap.get(log.userId) : null;
                  return (
                    <Tr key={log.id}>
                      <Td className="text-xs text-muted">{formatDateTime(log.createdAt)}</Td>
                      <Td className="text-xs">{u?.name ?? "System"}</Td>
                      <Td>
                        <Badge tone="neutral">{log.action}</Badge>
                      </Td>
                      <Td className="text-xs text-muted">
                        {log.entity}
                        {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                      </Td>
                      <Td className="max-w-[320px] truncate text-xs text-faint">
                        {log.detail ?? "—"}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <CardBody className="flex items-center justify-between pt-3">
            <span className="text-xs text-muted">
              Page {page} of {totalPages} · {total} entries
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/audit?action=${encodeURIComponent(action ?? "")}&entity=${encodeURIComponent(entity ?? "")}&page=${page - 1}`}
                  className={buttonClass("ghost", "sm")}
                >
                  Prev
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/audit?action=${encodeURIComponent(action ?? "")}&entity=${encodeURIComponent(entity ?? "")}&page=${page + 1}`}
                  className={buttonClass("ghost", "sm")}
                >
                  Next
                </Link>
              ) : null}
            </div>
          </CardBody>
        </Card>
      )}
    </>
  );
}