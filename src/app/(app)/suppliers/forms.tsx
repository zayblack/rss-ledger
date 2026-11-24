"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createSupplierAction,
  recordPaymentAction,
  updateSupplierAction,
  type FormState,
} from "@/actions/suppliers";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function CreateSupplierForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createSupplierAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Supplier name">
        <Input name="name" placeholder="e.g. Highland Traders" required maxLength={80} />
      </Field>

      <Field
        label="Share of sale price"
        hint="Percentage of the gross sale price their units earn."
      >
        <Input
          name="share"
          inputMode="decimal"
          placeholder="35"
          required
          className="num"
          defaultValue="35"
        />
      </Field>

      <Field label="Contact" hint="Optional — Discord handle, email, in-game name.">
        <Input name="contact" placeholder="@highland" maxLength={120} />
      </Field>

      <Field label="Notes" hint="Optional.">
        <Textarea name="notes" placeholder="Agreed terms, delivery schedule…" maxLength={500} />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Adding…" : "Add supplier"}
      </Button>
    </form>
  );
}

export function EditSupplierForm({
  supplier,
}: {
  supplier: {
    id: string;
    name: string;
    shareBps: number;
    contact: string | null;
    notes: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateSupplierAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={supplier.id} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field label="Supplier name">
        <Input name="name" defaultValue={supplier.name} required maxLength={80} />
      </Field>

      <Field label="Share of sale price" hint="Applies to future sales only.">
        <Input
          name="share"
          defaultValue={(supplier.shareBps / 100).toString()}
          inputMode="decimal"
          required
          className="num"
        />
      </Field>

      <Field label="Contact">
        <Input name="contact" defaultValue={supplier.contact ?? ""} maxLength={120} />
      </Field>

      <Field label="Notes">
        <Textarea name="notes" defaultValue={supplier.notes ?? ""} maxLength={500} />
      </Field>

      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export function PaymentForm({
  supplierId,
  balance,
  currency,
  today,
}: {
  supplierId: string;
  balance: number;
  currency: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    recordPaymentAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="supplierId" value={supplierId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field label={`Amount (${currency})`} hint={`Outstanding balance: ${balance.toLocaleString("en-US")}`}>
        <Input name="amount" inputMode="numeric" placeholder="0" required className="num" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input name="paidAt" type="date" defaultValue={today} required />
        </Field>
        <Field label="Method">
          <Select name="method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
            <option value="items">Items</option>
            <option value="other">Other</option>
          </Select>
        </Field>
      </div>

      <Field label="Note">
        <Input name="note" placeholder="Optional reference" maxLength={200} />
      </Field>

      <Button type="submit" className="w-full" disabled={pending || balance <= 0}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
