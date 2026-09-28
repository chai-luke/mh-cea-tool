// Default scenario = the workbook's default state (Ethiopia · Ochalek · Current treatment · USD · Consumed · channel on ·
// rebased · Proportional · floor · mortality off). `scenarioFromWorkbookState` builds the scenario the workbook was saved in
// (used by the parity harness).

import type { Dataset } from "./dataset";
import { paramNumber, paramText } from "./dataset";
import type { BiaInputs, Country, Scenario, UseCategory } from "./types";

/** The 14 Sep 2026 owner decisions (survival benefit on; Cobenfy adherence = oral) come from the workbook's Control cells
 *  (vS, session 1). `opts.workbook` is used by the parity harness: it only affects the survival product-layer default below. */

export function defaultBia(ds: Dataset): BiaInputs {
  return {
    currentBudgetUsd: null,
    wastage: paramNumber(ds, "P_BIA_WASTAGE", 0.15),
    adherenceApplied: paramText(ds, "P_BIA_ADHERENCE", "Yes") === "Yes",
    costBasis: paramText(ds, "P_BIA_COST_BASIS", "Medication only") === "Total" ? "Total" : "Medication only",
    mixBasis: paramText(ds, "P_BIA_MIX_BASIS", "Current tx (incumbent)") === "CE-optimised" ? "CE-optimised" : "Current tx (incumbent)",
    mixBasisByCategory: {},
    splits: {
      "Initiation + Maintenance": paramNumber(ds, "P_BIA_SPLIT_1", 0.55),
      "Maintenance": paramNumber(ds, "P_BIA_SPLIT_2", 0.15),
      "Treatment-resistant": paramNumber(ds, "P_BIA_SPLIT_3", 0.15),
      "Acute agitation": paramNumber(ds, "P_BIA_SPLIT_4", 0.15),
    },
    diagnosisRateSqOverride: null,
    goalCoverageOverride: null,
    productShareOverrides: {},
    extraProducts: {},
  };
}

/** LAI-vs-oral OR + clozapine HR survival layers. Owner decision 18 Sep 2026: a scenario, not base case. The workbook has no
 *  P_MORT_PRODUCT_LAYERS cell until the vS.1 prompt adds it, so while it is absent the parity harness (`workbook: true`) keeps the
 *  layers tied to the channel switch (the saved workbook state) and the app default is OFF. Once the cell exists it wins for both. */
function productLayersDefault(ds: Dataset, workbook: boolean): boolean {
  const p = ds.params.find((x) => x.paramId === "P_MORT_PRODUCT_LAYERS");
  if (p && typeof p.live === "string") return p.live === "Yes";
  return workbook ? paramText(ds, "P_MORT_CHANNEL", "No") === "Yes" : false;
}

export function defaultScenario(ds: Dataset, country: Country = "Ethiopia", _opts?: { workbook?: boolean }): Scenario {
  const included: Record<string, boolean> = {};
  const userUnitPrice: Record<string, number | null> = {};
  for (const p of ds.products) { included[p.intId] = (p.include ?? "Yes") === "Yes"; userUnitPrice[p.intId] = null; }
  return {
    country,
    comparator: "Current treatment",
    comparatorOverrides: {},
    thresholdMethod: "Ochalek (supply-side)",
    customThreshold: null,
    includeAdmin: true,
    adminPct: paramNumber(ds, "P_ADMIN_PCT", 0.12),
    currency: "USD",
    costing: "Consumed doses only",
    // the four method switches follow the workbook's Control tab (so a v33 flip of P_MORT_CHANNEL etc. carries into the web default)
    hospChannel: paramText(ds, "P_HOSP_EFFECT", "Yes") === "Yes",
    anchor: /^(untreated|as reported)/i.test(paramText(ds, "P_ADM_ANCHOR", "Comparator-rebased")) ? "Untreated baseline" : "Comparator-rebased",
    tfMethod: paramText(ds, "P_TF_METHOD", "Proportional").startsWith("Absolute") ? "Absolute (Andrews literal)" : "Proportional",
    tfFloor: paramText(ds, "P_TF_FLOOR", "Yes") === "Yes",
    mortalityScenario: paramText(ds, "P_MORT_CHANNEL", "No") === "Yes",
    mortalityProductLayers: productLayersDefault(ds, _opts?.workbook === true),
    admDiffLegacy: false,
    rwMultiplier: paramNumber(ds, "P_RW_MULT", 1),
    adherence: {
      oral: paramNumber(ds, "P_ADH_ORAL", 0.6), lai: paramNumber(ds, "P_ADH_LAI", 0.85),
      im: paramNumber(ds, "P_ADH_IM", 1),
      cobenfy: paramNumber(ds, "P_ADH_COBENFY", 0.55),
    },
    cpiInflate: false,
    included,
    userUnitPrice,
    admissionsRiskInput: null,
    headToHead: { a: "Paliperidone palmitate (LAI)", b: "Risperidone (oral)" },
    sensitivitySubject: "Olanzapine (IM, short-acting)",
    sensitivityComparator: null,
    sensitivityBounds: {},
    bia: defaultBia(ds),
  };
}

/** The scenario the workbook was saved in (from params.json setupStateAtSave). */
export function scenarioFromWorkbookState(ds: Dataset, state: {
  country: string; comparator: string; overrides: Record<string, unknown> | unknown[]; thresholdMethod: string; customThreshold: unknown;
  includeAdmin: string; adminPct: number; currency: string; costing: string; hospChannel: string; anchor: string; tfMethod: string; floor: string;
}): Scenario {
  const s = defaultScenario(ds, state.country as Country, { workbook: true });
  s.comparator = state.comparator as Scenario["comparator"];
  s.thresholdMethod = state.thresholdMethod as Scenario["thresholdMethod"];
  s.customThreshold = typeof state.customThreshold === "number" ? state.customThreshold : null;
  s.includeAdmin = state.includeAdmin === "Yes";
  s.adminPct = state.adminPct;
  s.currency = state.currency === "LCU" ? "LCU" : "USD";
  s.costing = state.costing as Scenario["costing"];
  s.hospChannel = state.hospChannel === "Yes";
  // Setup dropdown text became plain language in vS session 4 ("Adjusted for treatment (recommended)" / "As reported";
  // "Proportional (share of disability)" / "Absolute (fixed 0.181)"); normalise to the engine values either way.
  s.anchor = /^(untreated|as reported)/i.test(state.anchor ?? "") ? "Untreated baseline" : "Comparator-rebased";
  s.tfMethod = /absolute/i.test(state.tfMethod ?? "") ? "Absolute (Andrews literal)" : "Proportional";
  s.tfFloor = state.floor === "Yes";
  const ov = state.overrides;
  if (ov && !Array.isArray(ov)) {
    for (const [k, v] of Object.entries(ov)) if (typeof v === "string" && v.trim()) s.comparatorOverrides[k as UseCategory] = v;
  }
  // user prices typed into Products I at save time
  for (const p of ds.products) if (typeof p.userUnitPrice === "number" && p.userUnitPrice > 0) s.userUnitPrice[p.intId] = p.userUnitPrice;
  return s;
}
