import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { Card, CardBody, PageHeader, buttonClass } from "@/components/ui";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  await requireSession();
  return (
    <>
      <PageHeader
        title="Import resources"
        description="Paste CSV: name, unitLabel, unitPrice, lowStockThreshold."
        actions={
          <Link href="/settings" className={buttonClass("ghost", "md")}>
            <ArrowLeft className="size-4" />
            Settings
          </Link>
        }
      />
      <Card>
        <CardBody className="pt-3">
          <ImportForm />
        </CardBody>
      </Card>
    </>
  );
}