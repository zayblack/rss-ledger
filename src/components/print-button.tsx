"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "md")}>
      <Printer className="size-4" /> {label}
    </button>
  );
}
