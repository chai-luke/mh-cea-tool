// Core CEA engine — reproduces Calc-Direct / Calc-HRH / Calc-SE / Detailed Results / CE Dashboard of MH_CEA_Tool v32.
// Pure functions over (Scenario, Dataset). Excel quirks are reproduced deliberately and commented.

import type { Dataset, Intervention, MedCostRow, PriceSource, ProtocolRow } from "./dataset";
import { effectParam, mortalityParam } from "./dataset";
import type {
  AnalysisResult, CabinetSlot, CeBasis, CeStatus, HeadlineLabel, NoTreatmentResult, PriceResolution, ProductResult, Scenario,
  ThresholdResult, UseCategory,
} from "./types";
import { USE_CATEGORIES } from "./types";

const eq = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
const has = (s: string | null | undefined, sub: string) => (s ?? "").toLowerCase().includes(sub.toLowerCase());
const n0 = (x: number | null | undefined) => (typeof x === "number" && !Number.isNaN(x) ? x : 0);

export const VISIT_TYPES = { screening: "initial screening", prescription: "medication prescri", monitoring: "medication monitor" } as const;

// ---------------------------------------------------------------- FX / threshold

export function fxRate(ds: Dataset, s: Scenario): number {
  if (s.currency !== "LCU") return 1;
  return ds.thresholds.fx.find((f) => f.country === s.country)?.lcuPerUsd ?? 1;
}

export function resolveThreshold(ds: Dataset, s: Scenario, fx: number): ThresholdResult {
  const pick = (rows: { country: string; usd2026: number | null; source?: string | null }[], flag: string) => {
    const r = rows.find((x) => x.country === s.country);
    return r?.usd2026 != null ? { valueUsd: r.usd2026, flag: null as string | null, source: r.source ?? null } : { valueUsd: null, flag, source: null };
  };
  const MISSING = "NO THRESHOLD — country pending";
  let out: { valueUsd: number | null; flag: string | null; source: string | null };
  switch (s.thresholdMethod) {
    case "Pichon-Riviere (supply-side)": out = pick(ds.thresholds.pichonRiviere, MISSING); break;
    case "Ochalek (supply-side)": out = pick(ds.thresholds.ochalek, MISSING); break;
    case "1x GDP per capita": out = pick(ds.thresholds.gdpPerCapita, MISSING); break;
    case "National (SA domestic)": out = pick(ds.thresholds.national, "NO DOMESTIC THRESHOLD — country pending"); break;
    case "Custom":
      out = s.customThreshold != null && s.customThreshold > 0
        ? { valueUsd: s.customThreshold, flag: null, source: "User-entered custom threshold (USD)" }
        : pick(ds.thresholds.gdpPerCapita, MISSING); // workbook falls back to 1x GDP when Custom is blank
      break;
  }
  return { value: out.valueUsd != null ? out.valueUsd * fx : null, valueUsd: out.valueUsd, method: s.thresholdMethod, flag: out.flag, source: out.source };
}

// ---------------------------------------------------------------- prices & dosing

const TIER_RANK: Record<string, number> = { T1: 1, T2: 2, T3: 3, T4: 4 };

/** The tier protocol's default among a cell's price sources: lowest tier number, then lowest priority, then id.
 *  (Workbook: Src-Med Price Sources col O `IsDefault` = MINIFS on TierRank then Priority within the Key.) */
export function hierarchyDefault(rows: readonly PriceSource[]): PriceSource | null {
  const ok = rows.filter((r) => typeof r.priceUsd === "number" && r.priceUsd > 0);
  if (!ok.length) return null;
  return [...ok].sort((a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) || (a.priority ?? 5) - (b.priority ?? 5) || a.id.localeCompare(b.id))[0];
}

/** The price source in effect for a country: the user's pick if it names an existing row, else the hierarchy default. */
export function sourceInEffect(m: MedCostRow, country: string): { row: PriceSource; selected: boolean } | null {
  const rows = m.priceSources?.[country];
  if (!rows || !rows.length) return null;
  const pick = m.selectedSource?.[country];
  const chosen = pick ? rows.find((r) => r.id === pick) : undefined;
  if (chosen && chosen.priceUsd > 0) return { row: chosen, selected: true };
  const d = hierarchyDefault(rows);
  return d ? { row: d, selected: false } : null;
}

export function resolvePrice(ds: Dataset, s: Scenario, m: MedCostRow, fx: number): PriceResolution {
  const user = s.userUnitPrice[m.intId];
  const useUser = typeof user === "number" && user > 0;
  // 17 Sep 2026: selectable price sources take precedence over the legacy 4-column block when present.
  const src = sourceInEffect(m, s.country);
  if (src) {
    return {
      unitPrice: (useUser ? user : src.row.priceUsd) * fx,
      defaultUnitPrice: src.row.priceUsd * fx,
      userOverride: useUser ? user : null,
      basisUsed: useUser ? "user" : src.selected ? "selected-source" : "tier-default",
      tier: src.row.tier,
      source: src.row.label,
      sourceId: src.row.id,
    };
  }
  const basisKey = (ds.selectedPriceBasis || "Cheapest").toLowerCase() === "cheapest" ? "cheapest"
    : (ds.selectedPriceBasis || "").toLowerCase() === "average" ? "average"
    : (ds.selectedPriceBasis || "").toLowerCase() === "negotiated" ? "negotiated" : "bestCrossCountry";
  const block = m.prices[s.country] ?? { cheapest: null, average: null, negotiated: null, bestCrossCountry: null };
  const sel = block[basisKey];
  const positives = [block.cheapest, block.average, block.negotiated, block.bestCrossCountry].filter((x): x is number => typeof x === "number" && x > 0);
  let chain = 0; let basisUsed: PriceResolution["basisUsed"] = "none";
  if (typeof sel === "number" && sel > 0) { chain = sel; basisUsed = "selected-basis"; }
  else if (positives.length) { chain = Math.min(...positives); basisUsed = "min-in-country-block"; }
  else if (typeof m.otherDefault === "number") { chain = m.otherDefault; basisUsed = "other-default"; }
  const tier = m.tiers[s.country];
  return {
    unitPrice: (useUser ? user : chain) * fx,
    defaultUnitPrice: chain * fx,
    userOverride: useUser ? user : null,
    basisUsed: useUser ? "user" : basisUsed,
    tier: tier?.tier ?? null,
    source: tier?.source ?? m.otherDefaultSource ?? null,
    sourceId: null,
  };
}

export function dosing(ds: Dataset, iv: Intervention | undefined, m: MedCostRow): { unitsPerAdmin: number; adminsPerYr: number; annualUnits: number } {
  const inj = eq(m.injectable, "Yes");
  const unitsPerAdmin = m.doseMg == null || m.strengthMg == null ? 0 : inj ? Math.ceil(m.doseMg / m.strengthMg) : m.doseMg / m.strengthMg;
  let adminsPerYr = 0;
  if (m.frequency) {
    const ap = iv?.adminPerYr;
    if (inj && typeof ap === "number") adminsPerYr = ap;
    else adminsPerYr = n0(ds.frequencyPerYear[m.frequency]);
  }
  return { unitsPerAdmin, adminsPerYr, annualUnits: unitsPerAdmin * adminsPerYr };
}

export function adherenceFor(s: Scenario, iv: Intervention): number {
  if (iv.name === "Cobenfy (KarXT)") return s.adherence.cobenfy;
  if (has(iv.formulation, "LAI")) return s.adherence.lai;
  if (has(iv.formulation, "IM injection")) return s.adherence.im;
  return s.adherence.oral;
}

// ---------------------------------------------------------------- HRH

interface HrhContext { rates: (number)[]; providerNames: (string | null)[] }

/** Workbook quirk: the four $/min rates are looked up once per sheet from the provider labels on the
 *  FIRST protocol row of the FIRST product (haloperidol screening) for the live country. */
function hrhContext(ds: Dataset, country: string, fx: number): HrhContext {
  const first = ds.hrhProtocols[0];
  const names = (first?.byCountry[country]?.providers ?? []).map((p) => p.provider ?? null);
  // Src-HRH Unit Costs M = cost/min (USD) x P_FX: staff costs convert to LCU like every other cost family.
  const rates = names.map((nm) => {
    const r = ds.hrhUnitCosts.find((u) => u.country === country && eq(u.provider, nm));
    return n0(r?.costPerMinClean) * fx;
  });
  return { rates, providerNames: names };
}

function protocolRow(ds: Dataset, intId: string, visitPrefix: string): ProtocolRow | undefined {
  return ds.hrhProtocols.find((p) => p.intId === intId && (p.visitType ?? "").toLowerCase().startsWith(visitPrefix));
}

function costPerVisit(row: ProtocolRow | undefined, country: string, ctx: HrhContext): number {
  const provs = row?.byCountry[country]?.providers ?? [];
  let sum = 0;
  for (let k = 0; k < 4; k++) sum += n0(provs[k]?.timeMin) * n0(ctx.rates[k]);
  return sum;
}

export function hrhFor(ds: Dataset, country: string, iv: Intervention, ctx: HrhContext): { initial: number; maintenance: number; visitsPerYr: number; monitoringPerVisit: number } {
  const scr = protocolRow(ds, iv.intId, VISIT_TYPES.screening);
  const pre = protocolRow(ds, iv.intId, VISIT_TYPES.prescription);
  const mon = protocolRow(ds, iv.intId, VISIT_TYPES.monitoring);
  const initial = costPerVisit(scr, country, ctx) + costPerVisit(pre, country, ctx);
  const monitoringPerVisit = costPerVisit(mon, country, ctx);
  const ap = iv.adminPerYr;
  const visits = typeof ap === "number" ? ap : n0(mon?.byCountry[country]?.providers?.[0]?.visitsPerYr);
  return { initial, maintenance: monitoringPerVisit * visits, visitsPerYr: visits, monitoringPerVisit };
}

// ---------------------------------------------------------------- SE buckets

function seBucketValue(ds: Dataset, intId: string, which: "cost" | "decrement"): number {
  const map = ds.seProductMap.find((x) => x.intId === intId);
  const key = which === "cost" ? map?.costBucket : map?.decrementBucket;
  const b = ds.seBuckets.find((x) => eq(x.bucket, key));
  return which === "cost" ? n0(b?.mgmtCostUsd) : n0(b?.dwDecrement);
}

// ---------------------------------------------------------------- comparator grid

export function gridComparators(ds: Dataset, country: string): Record<UseCategory, string> {
  const row = ds.comparatorGrid.find((g) => g.country === country);
  const out = {} as Record<UseCategory, string>;
  for (const uc of USE_CATEGORIES) {
    const key = Object.keys(row ?? {}).find((k) => eq(k, uc));
    out[uc] = (key && row ? (row[key] as string) : "") ?? "";
  }
  return out;
}
function useCategoryOf(use: string): UseCategory | null {
  return USE_CATEGORIES.find((uc) => eq(uc, use)) ?? null;
}

// ---------------------------------------------------------------- main

export function analyze(s: Scenario, ds: Dataset): AnalysisResult {
  const flags: string[] = [];
  const fx = fxRate(ds, s);
  const threshold = resolveThreshold(ds, s, fx);
  if (threshold.flag) flags.push(threshold.flag);
  const lambda = threshold.value; // display currency
  const currencySymbol = s.currency === "LCU" ? (ds.currencies.find((c) => c.country === s.country)?.symbol ?? "$") : "$";
  const cpi = 1; // P_CPI_INFLATE = No in v32
  const adminPct = s.includeAdmin ? s.adminPct : 0;
  const fullCourse = s.costing === "Full course (incl. wastage)";

  // country inputs
  const inp = ds.inpatient.find((r) => r.country === s.country && eq(r.condition, "Schizophrenia"));
  const admissionProb = n0(inp?.admissionProb);
  const losDays = n0(inp?.losDays);
  const costPerDayUsd = n0(inp?.costPerDayUsd);
  const costPerDay = costPerDayUsd * fx;
  const grid = gridComparators(ds, s.country);
  const baselineDw = ds.disabilityWeights.find((d) => d.key === "Schizophrenia-Severe")?.dw ?? 0.778;
  const dwResidual = effectParam(ds, "DW_residual")?.value ?? 0.588;
  const kProp = effectParam(ds, "k_prop")?.value ?? 0.284;
  const kAbs = ds.transferFactors.find((t) => eq(t.condition, "Schizophrenia"))?.applied ?? ds.transferFactors.find((t) => has(t.condition, "Default"))?.applied ?? 0.181;
  const rrClass = ds.admissionRrOnTreatment.find((r) => has(r.bucket, "Class default"))?.rr ?? 0.43;
  const rrCloz = ds.admissionRrOnTreatment.find((r) => has(r.bucket, "Clozapine"))?.rr ?? 0.3;
  const rrOlz = ds.admissionRrOnTreatment.find((r) => has(r.bucket, "Olanzapine"))?.rr ?? 0.35;
  const rrQuet = ds.admissionRrOnTreatment.find((r) => has(r.bucket, "Quetiapine"))?.rr ?? 0.55;
  const mortRate = mortalityParam(ds, "Baseline mortality") ?? 0.01;
  const mortLaiOr = mortalityParam(ds, "LAI-vs-oral") ?? 0.79;
  const mortYll = mortalityParam(ds, "Discounted YLL") ?? 19.6;
  const mortTxHr = mortalityParam(ds, "Treated-vs-untreated") ?? 0.71;
  const mortClozHr = mortalityParam(ds, "Clozapine") ?? 0.74;
  const veryCeBand = 1 / 3;
  const hrhCtx = hrhContext(ds, s.country, fx);
  const admDiffFactor = (formulation: string) => {
    if (!s.admDiffLegacy) return 1;
    if (has(formulation, "LAI")) return n0(ds.rrByFormulationLegacy["LAI"]) || 1;
    if (has(formulation, "IM injection")) return n0(ds.rrByFormulationLegacy["IM short-acting"]) || 1;
    return n0(ds.rrByFormulationLegacy["Oral"]) || 1;
  };

  // ---- pass 1: everything except the admission anchor
  type Partial1 = Omit<ProductResult, "inpatient" | "total" | "admin" | "untreatedAdmission" | "absolutePerDaly" | "perDalyExInpatient" | "ceAbsolute" | "comparator" | "compNetDalys" | "compTotal" | "deltaDalys" | "deltaCost" | "icerVsComparator" | "ceBasis" | "headline" | "ceStatus" | "nmb" | "rank" | "netDalys">
    & { netDalysPre: number };
  const pass1: Partial1[] = ds.interventions.map((iv) => {
    const m = ds.medCosts.find((x) => x.intId === iv.intId)!;
    const prod = ds.products.find((x) => x.intId === iv.intId);
    const price = resolvePrice(ds, s, m, fx);
    const d = dosing(ds, iv, m);
    const medGross = d.annualUnits * price.unitPrice;
    const adherence = adherenceFor(s, iv);
    const medCosted = medGross * (fullCourse ? 1 : adherence);
    const hrh = hrhFor(ds, s.country, iv, hrhCtx);
    const seCost = seBucketValue(ds, iv.intId, "cost") * fx;
    // Library col T override first (17 Sep 2026: acute-agitation products all take the class RR), else the molecule name rule.
    const rrOverride = iv.rrBucket ? ds.admissionRrOnTreatment.find((r) => eq(r.bucket, iv.rrBucket))?.rr : undefined;
    const rrOnTx = typeof rrOverride === "number" ? rrOverride
      : has(iv.name, "Clozapine") ? rrCloz : has(iv.name, "Olanzapine") ? rrOlz : has(iv.name, "Quetiapine") ? rrQuet : rrClass;
    const rrEff = 1 - adherence * (1 - rrOnTx);
    const smd = n0(ds.efficacy.find((e) => e.intId === iv.intId)?.smd);
    const tf = s.tfMethod === "Proportional" ? kProp * baselineDw : kAbs;
    const cap = s.tfFloor ? baselineDw - dwResidual : 9e9;
    const grossDalys = Math.min(tf * smd, cap) * adherence * s.rwMultiplier;
    const seDecrement = seBucketValue(ds, iv.intId, "decrement") * s.rwMultiplier;
    const isLai = has(iv.formulation, "LAI");
    // Survival: treated-vs-untreated HR for every treated product when the channel is on; the LAI-vs-oral OR and clozapine HR
    // product layers only when the product-layer switch is also on (base case OFF since 18 Sep 2026: the LAI mortality advantage
    // is largely a continuity-of-treatment effect the adherence channel already credits).
    const productLayers = s.mortalityProductLayers ? (isLai ? 1 - mortLaiOr : 0) + (has(iv.name, "Clozapine") ? 1 - mortClozHr : 0) : 0;
    const mortalityDalys = s.mortalityScenario ? mortRate * mortYll * ((1 - mortTxHr) + productLayers) : 0;
    const included = s.included?.[iv.intId] ?? eq(prod?.include, "Yes"); // Products page tick overrides the workbook Include? column
    return {
      intId: iv.intId, name: iv.name, category: iv.category, formulation: iv.formulation, use: iv.use,
      dashboardUse: eq(iv.panelRecommended, "No") ? "(not panel-recommended)" : iv.use,
      included, whoEml: iv.whoEml, nationalEml: iv.nationalEml[s.country] ?? null,
      price, annualUnits: d.annualUnits, unitsPerAdmin: d.unitsPerAdmin, adminsPerYr: d.adminsPerYr,
      medGross, adherence, medCosted, hrhInitial: hrh.initial, hrhMaintenance: hrh.maintenance, seCost,
      wastage: medGross * (1 - adherence), rrOnTx, rrEff,
      baselineDw, smd, transferFactor: tf, grossDalys, seDecrement, mortalityDalys, netDalysPre: grossDalys - seDecrement + mortalityDalys,
    };
  });

  // ---- admission anchor (country-level)
  const initMaintComparator = (s.comparatorOverrides["Initiation + Maintenance"] ?? null) || grid["Initiation + Maintenance"];
  const compRow = pass1.find((p) => eq(p.name, initMaintComparator));
  const untreatedAdmission = s.hospChannel && s.anchor === "Comparator-rebased" && compRow ? admissionProb / compRow.rrEff : admissionProb;

  // ---- No treatment row
  const ntInpatient = s.hospChannel ? untreatedAdmission * 1 * losDays * costPerDay : admissionProb * losDays * costPerDay;
  const noTreatment: NoTreatmentResult = { inpatient: ntInpatient, total: ntInpatient * cpi, rrEff: 1, untreatedAdmission };

  // ---- pass 2: inpatient, totals, absolutes
  const pass2 = pass1.map((p) => {
    const inpatient = s.hospChannel
      ? untreatedAdmission * p.rrEff * losDays * costPerDay
      : admissionProb * admDiffFactor(p.formulation) * losDays * costPerDay;
    const admin = adminPct * (p.medCosted + p.hrhInitial + p.hrhMaintenance + inpatient + p.seCost);
    const total = (p.medCosted + p.hrhInitial + p.hrhMaintenance + inpatient + p.seCost + admin) * cpi;
    const netDalys = p.netDalysPre;
    const absolutePerDaly = netDalys > 0 ? total / netDalys : null;
    const perDalyExInpatient = netDalys > 0 ? (total - inpatient) / netDalys : null;
    const ceAbsolute: ProductResult["ceAbsolute"] = absolutePerDaly == null || lambda == null ? "" : absolutePerDaly <= lambda * veryCeBand ? "Very CE" : absolutePerDaly <= lambda ? "CE" : "Not CE";
    const { netDalysPre: _drop, ...rest } = p;
    return { ...rest, inpatient, admin, total, untreatedAdmission, netDalys, absolutePerDaly, perDalyExInpatient, ceAbsolute };
  });

  // ---- comparator block
  const byName = new Map(pass2.map((p) => [p.name.toLowerCase(), p]));
  const products: ProductResult[] = pass2.map((p) => {
    let comparator = "No treatment";
    if (s.comparator === "Current treatment") {
      const uc = useCategoryOf(p.use);
      const ovr = uc ? s.comparatorOverrides[uc] : null;
      comparator = (ovr && ovr.trim()) || (uc ? grid[uc] : "") || "";
    }
    const isNt = eq(comparator, "No treatment");
    const comp = isNt ? null : byName.get(comparator.toLowerCase());
    const compNetDalys = isNt ? 0 : comp ? comp.netDalys : null;
    const compTotal = isNt ? noTreatment.total : comp ? comp.total : null;
    const self = eq(comparator, p.name);
    const deltaDalys = compNetDalys == null ? null : p.netDalys - compNetDalys;
    const deltaCost = compTotal == null ? null : p.total - compTotal;
    let icerVsComparator: number | null = null;
    let ceBasis: CeBasis | "" = "";
    let headline: HeadlineLabel | number | "" = "";
    if (deltaDalys != null && deltaCost != null) {
      if (self) { ceBasis = "Current tx"; headline = "Reference"; }
      else if (deltaCost < 0 && deltaDalys < 0) { ceBasis = "Less costly, less effective"; headline = "(less costly, less effective)"; }
      else if (deltaCost <= 0 && deltaDalys >= 0) { ceBasis = "Dominant (cost-saving)"; headline = "(dominant, cost-saving)"; }
      else if (deltaCost >= 0 && deltaDalys <= 0) { ceBasis = "Dominated"; headline = "(dominated)"; }
      else { ceBasis = "Incremental"; headline = deltaCost / deltaDalys; }
      if (!self && deltaDalys > 0) icerVsComparator = deltaCost / deltaDalys;
    }
    // Detailed Results T
    let ceStatus: CeStatus = "";
    if (p.included) {
      if (ceBasis === "Current tx") ceStatus = "Current tx";
      else if (ceBasis === "Dominated") ceStatus = "Dominated";
      else if (ceBasis === "Dominant (cost-saving)") ceStatus = "Dominant (cost-saving)";
      else if (ceBasis === "Less costly, less effective") ceStatus = "SW quadrant";
      else if (typeof headline === "number" && lambda != null) ceStatus = headline <= lambda * veryCeBand ? "Very CE" : headline <= lambda ? "CE" : "Not CE";
    }
    const nmb = p.included && lambda != null && deltaDalys != null && deltaCost != null ? deltaDalys * lambda - deltaCost : null;
    return { ...p, comparator, compNetDalys, compTotal, deltaDalys, deltaCost, icerVsComparator, ceBasis, headline, ceStatus, nmb, rank: null };
  });

  // ---- ranking (Detailed Results V/X): dominated last; NMB desc; tiebreak lower cost then earlier row
  const rowOf = (p: ProductResult) => 10 + ds.interventions.findIndex((iv) => iv.intId === p.intId);
  const keyOf = (p: ProductResult) => (p.nmb ?? 0) - p.total / 1e6 + rowOf(p) / 1e8;
  const inc = products.filter((p) => p.included && p.nmb != null);
  const nonDom = inc.filter((p) => p.ceBasis !== "Dominated");
  const dom = inc.filter((p) => p.ceBasis === "Dominated");
  for (const p of nonDom) p.rank = nonDom.filter((q) => keyOf(q) > keyOf(p)).length + 1;
  for (const p of dom) p.rank = nonDom.length + dom.filter((q) => keyOf(q) > keyOf(p)).length + 1;
  const ranked = [...inc].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));

  // ---- cabinet (CE Dashboard rows 9-12)
  const slots: CabinetSlot[] = [];
  const cats = (ds.cabinetSlots.length ? ds.cabinetSlots : USE_CATEGORIES) as UseCategory[];
  const chosen: string[] = [];
  cats.forEach((uc, i) => {
    const notSw = (p: ProductResult) => p.ceBasis !== "Less costly, less effective";
    let pick: ProductResult | undefined;
    if (i === 1) {
      // slot 2: Maintenance OR Initiation+Maintenance, no exclusion of slot 1 (workbook as built)
      pick = ranked.find((p) => (eq(p.dashboardUse, uc) || eq(p.dashboardUse, cats[0])) && notSw(p));
    } else {
      pick = ranked.find((p) => eq(p.dashboardUse, uc) && notSw(p) && !chosen.some((c) => eq(c, p.name)));
    }
    if (pick) chosen.push(pick.name);
    slots.push({ slot: i + 1, useCategory: uc, product: pick?.name ?? null, headline: pick?.headline ?? null, ceBasis: pick?.ceBasis ?? null, whoEml: pick?.whoEml ?? null });
  });

  return {
    scenario: s, fx, currencySymbol, threshold, products, noTreatment, ranked, cabinet: slots,
    countryInputs: { admissionProb, losDays, costPerDayUsd, costPerDay, gridComparators: grid },
    flags,
  };
}
