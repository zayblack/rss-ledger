import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { LevelsEditor, ResourceForm, WorkspaceForm } from "./forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const [resources, levels] = await Promise.all([
    prisma.resource.findMany({
      where: { tenantId, archived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.tradingPostLevel.findMany({ where: { tenantId }, orderBy: { level: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure the ledger to match your game and your deals."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <Card>
          <CardHeader title="Workspace" subtitle="Name and currency shown across the app." />
          <CardBody className="pt-3">
            <WorkspaceForm name={session.tenant.name} currency={session.tenant.currency} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How the money works" subtitle="The rules this ledger applies." />
          <CardBody className="space-y-3 pt-3 text-xs leading-relaxed text-muted">
            <p>
              <span className="text-ink">Gross</span> is the sum of quantity × unit price on the
              sale. <span className="text-ink">Tax</span> is calculated per packed trip from the
              trading post table. <span className="text-ink">Net revenue</span> is gross minus tax.
            </p>
            <p>
              <span className="text-ink">Supplier share</span> is a percentage of the gross sale
              price of the exact units they supplied, frozen at the moment the shipment posts. Your{" "}
              <span className="text-ink">profit</span> is net revenue minus supplier shares.
            </p>
            <Alert tone="info">
              Sales consume the oldest supplier lots first (FIFO). Changing a supplier&apos;s share
              never rewrites past statements.
            </Alert>
          </CardBody>
        </Card>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink">Resources</h2>
            <p className="mt-0.5 text-xs text-muted">
              Your four resource types, their default prices, and low-stock warnings.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {resources.map((resource) => (
            <ResourceForm
              key={resource.id}
              resource={{
                id: resource.id,
                name: resource.name,
                unitLabel: resource.unitLabel,
                unitPrice: toNumber(resource.unitPrice),
                lowStockThreshold: toNumber(resource.lowStockThreshold),
              }}
            />
          ))}
        </div>
      </div>

      <div id="levels" className="mt-8 scroll-mt-24">
        <div className="mb-3">
          <h2 className="text-sm font-semibold tracking-tight text-ink">Trading post levels</h2>
          <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-muted">
            Each level caps the cargo value of one trip and sets how that trip is taxed. The values
            below are samples — replace them with your game&apos;s real table.
          </p>
        </div>

        <Card>
          <CardBody>
            {levels.length === 0 ? (
              <Alert tone="warn">
                No levels configured. Add at least one before planning a shipment.
              </Alert>
            ) : null}
            <LevelsEditor
              levels={levels.map((level) => ({
                level: level.level,
                maxCargoValue: toNumber(level.maxCargoValue),
                taxRateBps: level.taxRateBps,
                flatFee: toNumber(level.flatFee),
                minTax: toNumber(level.minTax),
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-faint">
        Posted shipments are immutable. To correct a mistake, void the shipment from its detail
        page — stock is restored and supplier credits are reversed automatically.
      </p>
    </>
  );
}
