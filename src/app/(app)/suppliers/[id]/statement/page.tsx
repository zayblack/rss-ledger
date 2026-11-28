import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toNumber, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { Card, CardBody, CardHeader, PageHeader, Table, Td, Th, Tr, buttonClass } from "@/components/ui";

export const metadata = { title: "Supplier statement" };

export default async function SupplierStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const currency = session.tenant.currency;
  const { id } = await params;

  const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } });
  if (!supplier) notFound();

  const ledger = await prisma.supplierLedgerEntry.findMany({
    where: { tenantId, supplierId: id },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });

  let running = 0;
  const rows = ledger.map((e) => {
    running += toNumber(e.amount);
    return { ...e, balance: running };
  });

  return (
    <>
      <PageHeader
        title={`Statement — ${supplier.name}`}
        description="Credits, payments, and running balance."
        actions={
          <div className="flex gap-2">
            <PrintButton />
            <Link href={`/suppliers/${id}`} className={buttonClass("ghost", "md")}>
              <ArrowLeft className="size-4" /> Back
            </Link>
          </div>
        }
      />
      <Card>
        <CardHeader title="Ledger" subtitle={`Supplier share: ${supplier.shareBps / 100}%`} />
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Note</Th>
                <Th align="right">Amount</Th>
                <Th align="right">Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="text-xs">{formatDate(r.occurredAt)}</Td>
                  <Td className="text-xs">{r.type}</Td>
                  <Td className="text-xs text-muted">{r.note ?? "—"}</Td>
                  <Td align="right" className={`num text-xs ${toNumber(r.amount) < 0 ? "text-danger" : "text-ink"}`}>
                    {toNumber(r.amount) > 0 ? "+" : ""}
                    {formatMoney(toNumber(r.amount), currency)}
                  </Td>
                  <Td align="right" className="num text-xs font-medium">
                    {formatMoney(r.balance, currency)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
        <CardBody className="flex justify-end pt-3">
          <div className="text-sm font-semibold">
            Closing balance: {formatMoney(running, currency)}
          </div>
        </CardBody>
      </Card>
    </>
  );
}