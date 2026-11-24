import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-[#052a20] hover:bg-[#4ee3b0] shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset]",
  secondary: "border border-line-strong bg-surface-2 text-ink hover:bg-white/[0.06]",
  ghost: "text-muted hover:bg-white/[0.05] hover:text-ink",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15",
  subtle: "bg-white/[0.05] text-ink hover:bg-white/[0.09]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface/80 backdrop-blur-[2px]", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

/* ---------------------------------- Inputs --------------------------------- */

export const inputClass =
  "h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-faint/70 transition-colors focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClass, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(inputClass, "h-auto min-h-20 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-[11px] font-medium uppercase tracking-wider text-faint">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[11px] leading-snug text-faint">{hint}</span> : null}
    </label>
  );
}

/* ---------------------------------- Badges --------------------------------- */

type Tone = "neutral" | "success" | "warn" | "danger" | "info" | "accent";

const badgeTones: Record<Tone, string> = {
  neutral: "border-line-strong bg-white/[0.04] text-muted",
  success: "border-accent/25 bg-accent/10 text-accent",
  warn: "border-warn/25 bg-warn/10 text-warn",
  danger: "border-danger/25 bg-danger/10 text-danger",
  info: "border-info/25 bg-info/10 text-info",
  accent: "border-accent/30 bg-accent/15 text-accent",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------- Stat ---------------------------------- */

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "accent" | "warn" | "danger";
  className?: string;
}) {
  const valueTone =
    tone === "accent"
      ? "text-accent"
      : tone === "warn"
        ? "text-warn"
        : tone === "danger"
          ? "text-danger"
          : "text-ink";

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</p>
      <p className={cn("num mt-2 text-xl font-semibold sm:text-2xl", valueTone)}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </Card>
  );
}

/* --------------------------------- PageHeader ------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------------------------------- Alert ---------------------------------- */

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    neutral: "border-line-strong bg-white/[0.03] text-muted",
    success: "border-accent/25 bg-accent/[0.07] text-accent",
    warn: "border-warn/25 bg-warn/[0.07] text-warn",
    danger: "border-danger/25 bg-danger/[0.07] text-danger",
    info: "border-info/25 bg-info/[0.07] text-info",
    accent: "border-accent/25 bg-accent/[0.07] text-accent",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-xs leading-relaxed", tones[tone], className)}>
      {children}
    </div>
  );
}

/* -------------------------------- EmptyState ------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface/40 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------- Table ---------------------------------- */

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  );
}

export function Th({
  className,
  align = "left",
  ...props
}: ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-faint",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  align = "left",
  ...props
}: ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "border-b border-line/60 px-4 py-3 text-sm text-ink last:border-0",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-white/[0.02]", className)} {...props} />;
}

/* --------------------------------- Progress -------------------------------- */

export function ProgressBar({
  value,
  tone = "accent",
  className,
}: {
  value: number;
  tone?: "accent" | "warn" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    accent: "bg-accent",
    warn: "bg-warn",
    danger: "bg-danger",
    info: "bg-info",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <div
        className={cn("h-full rounded-full transition-all", tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ---------------------------------- Kbd ------------------------------------ */

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}
