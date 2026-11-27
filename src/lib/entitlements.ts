/**
 * Entitlements — tier-aware feature gating.
 *
 * Plans: basic (free) | mid | premium
 * Enforcement happens in server actions via requireFeature / requireLimit.
 * UI should mirror these checks but never be the sole gate.
 */

export type Plan = "basic" | "mid" | "premium";

export const PLANS: Plan[] = ["basic", "mid", "premium"];

export function isPlan(value: string): value is Plan {
  return PLANS.includes(value as Plan);
}

export type Feature =
  | "advancedReports"
  | "csvExport"
  | "pdfExport"
  | "lowStockAlerts"
  | "scheduledReports"
  | "customBrandingName"
  | "customBrandingFull"
  | "webhooks"
  | "apiAccess"
  | "cloudBackups"
  | "prioritySupport";

export type LimitKey = "resources" | "suppliers" | "members" | "salesPerMonth";

export const PLAN_LIMITS: Record<Plan, Record<LimitKey, number>> = {
  basic: { resources: 4, suppliers: 3, members: 1, salesPerMonth: 20 },
  mid: { resources: 20, suppliers: 20, members: 3, salesPerMonth: Infinity },
  premium: { resources: Infinity, suppliers: Infinity, members: Infinity, salesPerMonth: Infinity },
};

export const PLAN_FEATURES: Record<Plan, Record<Feature, boolean>> = {
  basic: {
    advancedReports: false,
    csvExport: false,
    pdfExport: false,
    lowStockAlerts: false,
    scheduledReports: false,
    customBrandingName: false,
    customBrandingFull: false,
    webhooks: false,
    apiAccess: false,
    cloudBackups: false,
    prioritySupport: false,
  },
  mid: {
    advancedReports: true,
    csvExport: true,
    pdfExport: false,
    lowStockAlerts: true,
    scheduledReports: true,
    customBrandingName: true,
    customBrandingFull: false,
    webhooks: false,
    apiAccess: false,
    cloudBackups: false,
    prioritySupport: false,
  },
  premium: {
    advancedReports: true,
    csvExport: true,
    pdfExport: true,
    lowStockAlerts: true,
    scheduledReports: true,
    customBrandingName: true,
    customBrandingFull: true,
    webhooks: true,
    apiAccess: true,
    cloudBackups: true,
    prioritySupport: true,
  },
};

export type TenantEntitlements = {
  plan: Plan;
  limits: Record<LimitKey, number>;
  features: Record<Feature, boolean>;
};

export function entitlementsFor(plan: string): TenantEntitlements {
  const safePlan: Plan = isPlan(plan) ? plan : "basic";
  return {
    plan: safePlan,
    limits: PLAN_LIMITS[safePlan],
    features: PLAN_FEATURES[safePlan],
  };
}

export function canUse(plan: string, feature: Feature): boolean {
  return entitlementsFor(plan).features[feature];
}

export function withinLimit(plan: string, key: LimitKey, current: number): boolean {
  const limit = entitlementsFor(plan).limits[key];
  return current < limit;
}

export class EntitlementError extends Error {
  code: "feature_locked" | "limit_reached";
  feature?: Feature;
  limitKey?: LimitKey;
  plan: Plan;
  constructor(
    code: "feature_locked" | "limit_reached",
    plan: Plan,
    opts?: { feature?: Feature; limitKey?: LimitKey; message?: string },
  ) {
    super(opts?.message ?? (code === "feature_locked" ? "Upgrade required." : "Plan limit reached."));
    this.code = code;
    this.plan = plan;
    this.feature = opts?.feature;
    this.limitKey = opts?.limitKey;
  }
}

export function requireFeature(plan: string, feature: Feature): void {
  if (!canUse(plan, feature)) {
    throw new EntitlementError("feature_locked", entitlementsFor(plan).plan, {
      feature,
      message: `This feature requires a higher plan. Upgrade to unlock ${feature}.`,
    });
  }
}

export function requireLimit(plan: string, key: LimitKey, current: number): void {
  if (!withinLimit(plan, key, current)) {
    throw new EntitlementError("limit_reached", entitlementsFor(plan).plan, {
      limitKey: key,
      message: `You've reached the ${key} limit for your plan. Upgrade to continue.`,
    });
  }
}

/** Human-readable plan name. */
export function planLabel(plan: string): string {
  const p = entitlementsFor(plan).plan;
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Next tier up, or null if already premium. */
export function nextPlan(plan: string): Plan | null {
  const p = entitlementsFor(plan).plan;
  if (p === "basic") return "mid";
  if (p === "mid") return "premium";
  return null;
}