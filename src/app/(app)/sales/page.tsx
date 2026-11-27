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

export const metadata = { title: "Sales" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "posted", label: "Posted" },
  { key: "draft", label: "Drafts" },
  { key: "void", label: "Void" },
] as const;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const currency = session.tenant.currency;
  const { status } = await searchParams;

  const active = FILTERS.some((filter) => filter.key === status) ? status! : "all";

  const sales = await prisma.sale.findMany({
    where: { tenantId, ...(active === "all" ? {} : { status: active }) },
    orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const posted = sales.filter((sale) => sale.status === "posted");
  const netTotal = posted.reduce((sum, sale) => sum + toNumber(sale.netTotal), 0);
  const taxTotal = posted.reduce((sum, sale) => sum + toNumber(sale.taxTotal), 0);

  return (
    <>
      <PageHeader
        title="Sales"
        description="Every sale, its trips, its tax, and the supplier shares it created."
        actions={
          <Link href="/sales/new" className={buttonClass("primary", "md")}>
            <Plus className="size-4" />
            Plan sale
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-line bg-surface/60 p-1">
          {FILTERS.map((filter) => (
            <Link
              key={filter.key}
              href={filter.key === "all" ? "/sales" : `/sales?status=${filter.key}`}
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
        {sales.length === 0 ? (
          <EmptyState
            className="m-5"
            icon={<Truck className="size-6" />}
            title={active === "all" ? "No sales yet" : `No ${active} sales`}
            description="Plan a sale to pack trips, calculate tax and credit suppliers in one step."
            action={
              <Link href="/sales/new" className={buttonClass("primary", "sm")}>
                Plan a sale
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
              {sales.map((sale) => (
                <Tr key={sale.id}>
                  <Td>
                    <Link
                      href={`/sales/${sale.id}`}
                      className="num text-xs font-medium text-accent hover:underline"
                    >
                      {sale.reference}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted">
                    {formatDate(sale.soldAt)}
                  </Td>
                  <Td className="max-w-[180px] truncate text-xs">{sale.customerName}</Td>
                  <Td align="right" className="num text-xs text-muted">
                    {formatAmount(toNumber(sale.grossTotal))}
                  </Td>
                  <Td align="right" className="num text-xs text-warn">
                    {formatAmount(toNumber(sale.taxTotal))}
                  </Td>
                  <Td align="right" className="num text-xs font-medium">
                    {formatAmount(toNumber(sale.netTotal))}
                  </Td>
                  <Td align="right" className="num text-xs text-muted">
                    {formatAmount(toNumber(sale.supplierShareTotal))}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        sale.status === "posted"
                          ? "success"
                          : sale.status === "void"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {sale.status}
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
