import Link from "next/link";
import { Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatAmount, formatMoney, toNumber } from "@/lib/money";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { CreateSupplierForm } from "./forms";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const currency = session.tenant.currency;

  const [suppliers, balanceRows, soldRows] = await Promise.all([
    prisma.supplier.findMany({
      where: { tenantId },
      orderBy: [{ archived: "asc" }, { name: "asc" }],
    }),
    prisma.supplierLedgerEntry.groupBy({
      by: ["supplierId"],
      where: { tenantId },
      _sum: { amount: true },
    }),
    prisma.lotConsumption.groupBy({
      by: ["supplierId"],
      where: { sale: { tenantId, status: "posted" } },
      _sum: { quantity: true, shareAmount: true },
    }),
  ]);

  const balances = new Map(balanceRows.map((row) => [row.supplierId, toNumber(row._sum.amount)]));
  const sold = new Map(
    soldRows.map((row) => [
      row.supplierId,
      {
        units: toNumber(row._sum?.quantity),
        earned: toNumber(row._sum?.shareAmount),
      },
    ]),
  );

  const totalOwed = suppliers.reduce(
    (sum, supplier) => sum + Math.max(0, balances.get(supplier.id) ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Who supplies your stock, what their units earned, and what you still owe."
      />

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <Card>
          <CardHeader
            title="Your suppliers"
            subtitle={`${suppliers.length} total · ${formatMoney(totalOwed, currency)} outstanding`}
          />
          <div className="mt-3">
            {suppliers.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  icon={<Users className="size-6" />}
                  title="No suppliers yet"
                  description="Add the people and camps that deliver your resources. Their share is credited when their units sell."
                />
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Supplier</Th>
                    <Th align="right">Share</Th>
                    <Th align="right">Units sold</Th>
                    <Th align="right">Earned</Th>
                    <Th align="right">Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => {
                    const balance = balances.get(supplier.id) ?? 0;
                    const totals = sold.get(supplier.id) ?? { units: 0, earned: 0 };
                    return (
                      <Tr key={supplier.id}>
                        <Td>
                          <Link
                            href={`/suppliers/${supplier.id}`}
                            className="flex items-center gap-2 text-sm font-medium text-ink hover:text-accent"
                          >
                            <span className="truncate">{supplier.name}</span>
                            {supplier.archived ? <Badge tone="neutral">archived</Badge> : null}
                          </Link>
                          {supplier.contact ? (
                            <p className="mt-0.5 truncate text-[10px] text-faint">
                              {supplier.contact}
                            </p>
                          ) : null}
                        </Td>
                        <Td align="right" className="num text-xs text-muted">
                          {(supplier.shareBps / 100).toFixed(1).replace(/\.0$/, "")}%
                        </Td>
                        <Td align="right" className="num text-xs text-muted">
                          {formatAmount(totals.units)}
                        </Td>
                        <Td align="right" className="num text-xs text-muted">
                          {formatAmount(totals.earned)}
                        </Td>
                        <Td
                          align="right"
                          className={`num text-xs font-medium ${
                            balance > 0 ? "text-warn" : balance < 0 ? "text-danger" : "text-muted"
                          }`}
                        >
                          {formatMoney(balance, currency)}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Add a supplier"
            subtitle="Their share applies to the gross sale price of their units."
          />
          <CardBody className="pt-3">
            <CreateSupplierForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
