export type ThemeId =
  | "light"
  | "dark"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "indigo"
  | "violet"
  | "custom";

export type ThemeTier = "basic" | "mid" | "premium";

export type ThemeDef = {
  id: ThemeId;
  label: string;
  tier: ThemeTier;
  // CSS variable overrides applied on html[data-theme]
  vars: Record<string, string>;
};

const ACCENT_SOFT = (hex: string) => `color-mix(in oklab, ${hex} 18%, transparent)`;

export const THEMES: ThemeDef[] = [
  {
    id: "dark",
    label: "Dark",
    tier: "basic",
    vars: {},
  },
  {
    id: "light",
    label: "Light",
    tier: "basic",
    vars: {
      "--color-canvas": "#f6f8fa",
      "--color-surface": "#ffffff",
      "--color-surface-2": "#eef2f6",
      "--color-line": "#d7dee6",
      "--color-line-strong": "#b8c3cf",
      "--color-ink": "#0f1720",
      "--color-muted": "#4b5a6b",
      "--color-faint": "#7b8a9b",
      "--color-accent": "#0f9f6e",
      "--color-accent-soft": "#d7f3e9",
      "--color-warn": "#b7791f",
      "--color-warn-soft": "#faf0d7",
      "--color-danger": "#c53030",
      "--color-danger-soft": "#fce4e4",
      "--color-info": "#2b6cb0",
      "--color-info-soft": "#e1ecf7",
    },
  },
  ...(["red", "orange", "yellow", "green", "blue", "indigo", "violet"] as const).map((name) => {
    const hex = {
      red: "#ef4444",
      orange: "#f97316",
      yellow: "#eab308",
      green: "#22c55e",
      blue: "#3b82f6",
      indigo: "#6366f1",
      violet: "#8b5cf6",
    }[name] as string;
    return {
      id: name as ThemeId,
      label: name.charAt(0).toUpperCase() + name.slice(1),
      tier: "mid" as ThemeTier,
      vars: {
        "--color-accent": hex,
        "--color-accent-soft": ACCENT_SOFT(hex),
      },
    };
  }),
];

export function themeTierOk(plan: string, themeId: ThemeId): boolean {
  const theme = THEMES.find((t) => t.id === themeId) ?? (themeId === "custom" ? { tier: "premium" } : null);
  if (!theme) return false;
  const order = { basic: 0, mid: 1, premium: 2 };
  return (order[plan as keyof typeof order] ?? 0) >= (order[theme.tier as keyof typeof order] ?? 0);
}

export function themeDef(id: ThemeId): ThemeDef | undefined {
  return THEMES.find((t) => t.id === id);
}

export function themeCssVars(themeId: ThemeId, customAccent?: string | null): string {
  const def = themeDef(themeId);
  const vars = { ...(def?.vars ?? {}) };
  if (themeId === "custom" && customAccent) {
    vars["--color-accent"] = customAccent;
    vars["--color-accent-soft"] = ACCENT_SOFT(customAccent);
  }
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
}