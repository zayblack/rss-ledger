"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "@/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          autoFocus
        />
      </Field>

      <Field label="Password">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
