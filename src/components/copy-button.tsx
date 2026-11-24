"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "./ui";

export function CopyButton({
  value,
  label = "Copy link",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      {copied ? <Check className="size-3 text-accent" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}
