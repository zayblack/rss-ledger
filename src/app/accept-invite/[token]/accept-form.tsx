"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AuthState } from "@/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function AcceptInviteForm({
  token,
  email,
  defaultWorkspace,
}: {
  token: string;
  email: string;
  defaultWorkspace: string;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(acceptInviteAction, {});

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted">
        Joining as <span className="font-medium text-ink">{email}</span>
      </div>

      <Field label="Your name">
        <Input name="name" autoComplete="name" placeholder="Alex Carter" required autoFocus />
      </Field>

      <Field label="Workspace name" hint="You can rename this later.">
        <Input name="workspaceName" defaultValue={defaultWorkspace} placeholder="My Trading Post" />
      </Field>

      <Field label="Password" hint="At least 8 characters.">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          minLength={8}
          required
        />
      </Field>

      <Field label="Confirm password">
        <Input
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          minLength={8}
          required
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating workspace…" : "Create my workspace"}
      </Button>
    </form>
  );
}
