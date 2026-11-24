import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatAmount, formatMoney, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/format";
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
  cn,
} from "@/components/ui";

export const metadata = { title: "Shipments" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "posted", label: "Posted" },
  { key: "draft", label: "Drafts" },
  { key: "void", label: "Void" },
] as const;

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const currency = session.tenant.currency;
  const { status } = await searchParams;

  const active = FILTERS.some((filter) => filter.key === status) ? status! : "all";

  const shipments = await prisma.shipment.findMany({
    where: { tenantId, ...(active === "all" ? {} : { status: active }) },
    orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const posted = shipments.filter((shipment) => shipment.status === "posted");
  const netTotal = posted.reduce((sum, shipment) => sum + toNumber(shipment.netTotal), 0);
  const taxTotal = posted.reduce((sum, shipment) => sum + toNumber(shipment.taxTotal), 0);

  return (
    <>
      <PageHeader
        title="Shipments"
        description="Every sale, its trips, its tax, and the supplier shares it created."
        actions={
          <Link href="/shipments/new" className={buttonClass("primary", "md")}>
            <Plus className="size-4" />
            Plan shipment
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-line bg-surface/60 p-1">
          {FILTERS.map((filter) => (
            <Link
              key={filter.key}
              href={filter.key === "all" ? "/shipments" : `/shipments?status=${filter.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs transition-colors",
                active === filter.key
                  ? "bg-white/[0.07] font-medium text-ink"
                  : "text-muted hover:text-ink",
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        {posted.length > 0 ? (
          <p className="text-xs text-muted">
            {posted.length} posted · net{" "}
            <span className="num text-accent">{formatMoney(netTotal, currency)}</span> · tax{" "}
            <span className="num text-warn">{formatMoney(taxTotal, currency)}</span>
          </p>
        ) : null}
      </div>

      <Card>
        {shipments.length === 0 ? (
          <EmptyState
            className="m-5"
            icon={<Truck className="size-6" />}
            title={active === "all" ? "No shipments yet" : `No ${active} shipments`}
            description="Plan a shipment to pack trips, calculate tax and credit suppliers in one step."
            action={
              <Link href="/shipments/new" className={buttonClass("primary", "sm")}>
                Plan a shipment
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ref</Th>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th align="right">Gross</Th>
                <Th align="right">Tax</Th>
                <Th align="right">Net</Th>
                <Th align="right">Suppliers</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <Tr key={shipment.id}>
                  <Td>
                    <Link
                      href={`/shipments/${shipment.id}`}
                      className="num text-xs font-medium text-accent hover:underline"
                    >
                      {shipment.reference}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted">
                    {formatDate(shipment.soldAt)}
                  </Td>
                  <Td className="max-w-[180px] truncate text-xs">{shipment.customerName}</Td>
                  <Td align="right" className="num text-xs text-muted">
                    {formatAmount(toNumber(shipment.grossTotal))}
                  </Td>
                  <Td align="right" className="num text-xs text-warn">
                    {formatAmount(toNumber(shipment.taxTotal))}
                  </Td>
                  <Td align="right" className="num text-xs font-medium">
                    {formatAmount(toNumber(shipment.netTotal))}
                  </Td>
                  <Td align="right" className="num text-xs text-muted">
                    {formatAmount(toNumber(shipment.supplierShareTotal))}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        shipment.status === "posted"
                          ? "success"
                          : shipment.status === "void"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {shipment.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
