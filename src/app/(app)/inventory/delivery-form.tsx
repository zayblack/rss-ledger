"use client";

import { useActionState } from "react";
import { recordDeliveryAction, type FormState } from "@/actions/inventory";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function DeliveryForm({
  suppliers,
  resources,
  today,
  currency,
}: {
  suppliers: { id: string; name: string }[];
  resources: { id: string; name: string; unitLabel: string }[];
  today: string;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    recordDeliveryAction,
    {},
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {state.error ? (
        <div className="sm:col-span-2">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}

      <Field label="Supplier" className="sm:col-span-2">
        <Select name="supplierId" required defaultValue="">
          <option value="" disabled>
            Choose a supplier
          </option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Resource">
        <Select name="resourceId" required defaultValue="">
          <option value="" disabled>
            Choose a resource
          </option>
          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Quantity received">
        <Input name="quantity" inputMode="numeric" placeholder="0" required className="num" />
      </Field>

      <Field label="Delivery date">
        <Input name="receivedAt" type="date" defaultValue={today} required />
      </Field>

      <Field label={`Unit cost (${currency})`} hint="Optional — what you paid per unit.">
        <Input name="unitCost" inputMode="numeric" placeholder="0" className="num" />
      </Field>

      <Field label="Note" className="sm:col-span-2">
        <Textarea name="note" placeholder="Optional — trip, batch, agreed price." maxLength={500} />
      </Field>

      <div className="sm:col-span-2">
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Recording…" : "Record delivery"}
        </Button>
      </div>
    </form>
  );
}
