// One-way sensitivity (Sensitivity tab two-arm block): ICER of the selected product vs its comparator with one parameter at a time at low/high.
// Reproduces the workbook block: gross effect = TF x SMD x adherence x RW with NO GBD cap and no mortality term (as built).
import type { Dataset } from "./dataset";
import { effectParam, mortalityParam } from "./dataset";
import { analyze } from "./core";
import type { AnalysisResult, ProductResult, Scenario, SensitivityResult, TornadoRow } from "./types";

const eq = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
const has = (s: string | null | undefined, sub: string) => (s ?? "").toLowerCase().includes(sub.toLowerCase());

interface ArmBase { name: string; isNt: boolean; costAdh: number; smd: number; tf: number; adhEff: number; rw: number; dec: number; medGross: number; hrh: number; costDay: number; seCost: number; ak: number; aj: number; isLai: boolean; isCloz: boolean }
interface ArmVals { tf: number; adhEff: number; rw: number; dec: number; medGross: number; hrh: number; costDay: number; seCost: number; hrTx: number; orLai: number; hrCloz: number }

export function tornado(r: AnalysisResult, ds: Dataset, subjectName: string, comparatorOverride?: string | null): SensitivityResult | null {
  const s = r.scenario;
  const S = r.products.find((p) => eq(p.name, subjectName));
  if (!S) return null;
  const compName = (comparatorOverride && comparatorOverride.trim()) || S.comparator || "No treatment";
  const isNtComp = eq(compName, "No treatment");
  const C: ProductResult | null = isNtComp ? null : (r.products.find((p) => eq(p.name, compName)) ?? null);
  const adm = s.includeAdmin ? s.adminPct : 0;
  const fullCourse = s.costing === "Full course (incl. wastage)";
  const los = r.countryInputs.losDays; const costDay = r.countryInputs.costPerDay; const pAdm = r.countryInputs.admissionProb;
  // survival term (Calc-Direct mortality block): rate x YLL x ((1-HR_tx) + [LAI layer + clozapine layer when the product-layer switch is on]); zero when the channel is off
  const mortRate = mortalityParam(ds, "Baseline mortality") ?? 0.01; const mortYll = mortalityParam(ds, "Discounted YLL") ?? 19.6;
  const hrTx0 = mortalityParam(ds, "Treated-vs-untreated") ?? 0.71; const orLai0 = mortalityParam(ds, "LAI-vs-oral") ?? 0.79; const hrCloz0 = mortalityParam(ds, "Clozapine") ?? 0.74;
  const dsBucket = (p: ProductResult) => ds.seBuckets.find((b) => eq(b.bucket, ds.seProductMap.find((m) => m.intId === p.intId)?.decrementBucket));

  const base = (p: ProductResult | null): ArmBase => p
    ? { name: p.name, isNt: false, costAdh: p.adherence, smd: p.smd, tf: p.transferFactor, adhEff: p.adherence, rw: s.rwMultiplier, dec: p.seDecrement / (s.rwMultiplier || 1), medGross: p.medGross, hrh: p.hrhInitial + p.hrhMaintenance, costDay, seCost: p.seCost, ak: p.untreatedAdmission, aj: p.rrEff, isLai: has(p.formulation, "LAI"), isCloz: has(p.name, "Clozapine") }
    : { name: "No treatment", isNt: true, costAdh: 0, smd: 0, tf: S.transferFactor, adhEff: 0, rw: s.rwMultiplier, dec: 0, medGross: 0, hrh: 0, costDay, seCost: 0, ak: r.noTreatment.untreatedAdmission, aj: 1, isLai: false, isCloz: false };
  const bS = base(S); const bC = base(C);

  const armTotalU = (b: ArmBase, v: ArmVals) => {
    const medNet = v.medGross * (fullCourse ? 1 : b.costAdh);
    const inpatient = s.hospChannel ? b.ak * b.aj * los * v.costDay : pAdm * los * v.costDay;
    const subtotal = medNet + v.hrh + inpatient + v.seCost;
    const admin = b.isNt ? 0 : adm * subtotal;
    const total = subtotal + admin;
    const gross = v.tf * b.smd * v.adhEff * v.rw;
    const layers = s.mortalityProductLayers ? (b.isLai ? 1 - v.orLai : 0) + (b.isCloz ? 1 - v.hrCloz : 0) : 0;
    const mort = s.mortalityScenario && !b.isNt ? mortRate * mortYll * ((1 - v.hrTx) + layers) : 0;
    const U = gross - v.dec * v.rw + mort;
    return { total, U };
  };
  const icer = (aS: { total: number; U: number }, aC: { total: number; U: number }): number | string => {
    if (eq(S.name, compName)) return aS.U > 0 ? aS.total / aS.U : "(n/a)";
    const dC = aS.total - aC.total, dU = aS.U - aC.U;
    if (dU > 0 && dC < 0) return "(dominant, cost-saving)";
    if (dU > 0) return dC / dU;
    if (dU < 0 && dC < 0) return "(less costly, less effective)";
    return "(dominated)";
  };
  const valsOf = (b: ArmBase): ArmVals => ({ tf: b.tf, adhEff: b.adhEff, rw: b.rw, dec: b.dec, medGross: b.medGross, hrh: b.hrh, costDay: b.costDay, seCost: b.seCost, hrTx: hrTx0, orLai: orLai0, hrCloz: hrCloz0 });
  const baseIcer = icer(armTotalU(bS, valsOf(bS)), armTotalU(bC, valsOf(bC)));

  // parameter table (rows 19-26)
  const kp = effectParam(ds, "k_prop"); const ka = effectParam(ds, "k_abs");
  const tfLow = s.tfMethod === "Proportional" ? (kp?.low ?? 0.163) * S.baselineDw : (ka?.low ?? 0.104);
  const tfHigh = s.tfMethod === "Proportional" ? (kp?.high ?? 0.32) * S.baselineDw : (ka?.high ?? 0.204);
  const adhLow = S.name === "Cobenfy (KarXT)" ? 0.45 : 0.75 * S.adherence;
  const adhHigh = S.name === "Cobenfy (KarXT)" ? 0.65 : Math.min(1, 1.25 * S.adherence);
  const bucket = dsBucket(S);
  type P = { parameter: string; scope: "Global" | "Drug"; key: keyof ArmVals; base: number; low: number; high: number };
  const params: P[] = [
    { parameter: "Transfer factor", scope: "Global", key: "tf", base: bS.tf, low: tfLow, high: tfHigh },
    { parameter: "Effect-side adherence (selected drug)", scope: "Drug", key: "adhEff", base: bS.adhEff, low: adhLow, high: adhHigh },
    { parameter: "Real-world multiplier", scope: "Global", key: "rw", base: bS.rw, low: 1, high: 1 }, // fixed at 1.0 and hidden (owner 2026-09-14); bounds mirror the workbook row
    { parameter: "Survival HR — any antipsychotic vs none", scope: "Global", key: "hrTx", base: hrTx0, low: 0.48, high: 0.81 },
    { parameter: "Survival OR — LAI vs oral", scope: "Global", key: "orLai", base: orLai0, low: 0.67, high: 1 },
    { parameter: "Survival HR — clozapine", scope: "Global", key: "hrCloz", base: hrCloz0, low: 0.43, high: 0.74 },
    { parameter: "SE disability decrement (unadjusted class value)", scope: "Drug", key: "dec", base: bS.dec, low: bucket?.low ?? 0, high: bucket?.high ?? bS.dec },
    { parameter: "Medication gross cost ($/yr)", scope: "Drug", key: "medGross", base: bS.medGross, low: 0.75 * bS.medGross, high: 1.25 * bS.medGross },
    { parameter: "HRH cost, initial + maintenance ($/yr)", scope: "Drug", key: "hrh", base: bS.hrh, low: 0.75 * bS.hrh, high: 1.25 * bS.hrh },
    { parameter: "Inpatient cost per day ($)", scope: "Global", key: "costDay", base: costDay, low: 2, high: 8 },
    { parameter: "SE management cost, class ($/yr)", scope: "Drug", key: "seCost", base: bS.seCost, low: 0.5 * bS.seCost, high: 1.5 * bS.seCost },
  ];
  for (const p of params) {
    const b = s.sensitivityBounds?.[p.parameter];
    if (b?.low != null) p.low = b.low;
    if (b?.high != null) p.high = b.high;
  }
  const rows: TornadoRow[] = params.map((p) => {
    const run = (val: number) => {
      const vS = { ...valsOf(bS), [p.key]: val } as ArmVals;
      const vC = p.scope === "Global" ? ({ ...valsOf(bC), [p.key]: p.key === "tf" || p.key === "rw" || p.key === "costDay" || p.key === "hrTx" || p.key === "orLai" || p.key === "hrCloz" ? val : bC[p.key] } as ArmVals) : valsOf(bC);
      return icer(armTotalU(bS, vS), armTotalU(bC, vC));
    };
    const lo = run(p.low), hi = run(p.high);
    return { parameter: p.parameter, scope: p.scope, base: p.base, low: p.low, high: p.high, icerAtLow: lo, icerAtHigh: hi, swing: typeof lo === "number" && typeof hi === "number" ? Math.abs(hi - lo) : null };
  });

  // scenario rows via full re-analysis (consistent with the engine rather than the block's shortcuts)
  // classification mirrors the engine comparator block (core.ts) so scenario rows read like the dashboard headline
  const classify = (dC: number, dU: number): number | string => {
    if (dC < 0 && dU < 0) return "(less costly, less effective)";
    if (dC <= 0 && dU >= 0) return "(dominant, cost-saving)";
    if (dC >= 0 && dU <= 0) return "(dominated)";
    return dC / dU;
  };
  const scenarioIcer = (mod: (sc: Scenario) => Scenario, dsMod?: (d: Dataset) => Dataset): number | string => {
    const r2 = analyze(mod({ ...s, comparatorOverrides: { ...s.comparatorOverrides } }), dsMod ? dsMod(ds) : ds);
    const p2 = r2.products.find((p) => eq(p.name, S.name));
    if (!p2) return "(n/a)";
    if (isNtComp) { const dU = p2.netDalys, dC = p2.total - r2.noTreatment.total; return dU > 0 ? dC / dU : "(n/a)"; }
    if (eq(S.name, compName)) return p2.netDalys > 0 ? p2.total / p2.netDalys : "(n/a)";
    const c2 = r2.products.find((p) => eq(p.name, compName));
    if (!c2) return "(n/a)";
    return classify(p2.total - c2.total, p2.netDalys - c2.netDalys);
  };
  const withRr = (rr: number) => (d: Dataset): Dataset => ({ ...d, admissionRrOnTreatment: d.admissionRrOnTreatment.map((x) => has(x.bucket, "Class default") ? { ...x, rr } : x) });
  const classRow = ds.admissionRrOnTreatment.find((x) => has(x.bucket, "Class default"));
  const extras: TornadoRow[] = [
    (() => { const on = s.mortalityScenario; const v = scenarioIcer((sc) => ({ ...sc, mortalityScenario: !on })); return { parameter: on ? "Survival benefit of treatment OFF (trial-evidence-only view)" : "Survival benefit of treatment ON (observational evidence)", scope: "Scenario" as const, base: null, low: null, high: null, icerAtLow: v, icerAtHigh: baseIcer, swing: typeof v === "number" && typeof baseIcer === "number" ? Math.abs(v - baseIcer) : null }; })(),
    (() => { const on = s.mortalityProductLayers; const v = scenarioIcer((sc) => ({ ...sc, mortalityScenario: true, mortalityProductLayers: !on })); return { parameter: on ? "LAI and clozapine survival layers OFF" : "LAI and clozapine survival layers ON (observational; OR 0.79 / HR 0.74)", scope: "Scenario" as const, base: null, low: null, high: null, icerAtLow: v, icerAtHigh: baseIcer, swing: typeof v === "number" && typeof baseIcer === "number" ? Math.abs(v - baseIcer) : null }; })(),
    (() => { const v = scenarioIcer((sc) => ({ ...sc, costing: "Full course (incl. wastage)" })); return { parameter: "Medication costing basis — full course incl. wastage", scope: "Scenario" as const, base: null, low: null, high: null, icerAtLow: v, icerAtHigh: typeof baseIcer === "number" ? baseIcer : baseIcer, swing: typeof v === "number" && typeof baseIcer === "number" ? Math.abs(v - baseIcer) : null }; })(),
    (() => { const lo = scenarioIcer((sc) => sc, withRr(classRow?.low ?? 0.32)); const hi = scenarioIcer((sc) => sc, withRr(classRow?.high ?? 0.57)); return { parameter: `Admission RR on treatment, class ${classRow?.low ?? 0.32}–${classRow?.high ?? 0.57}`, scope: "Scenario" as const, base: classRow?.rr ?? null, low: classRow?.low ?? null, high: classRow?.high ?? null, icerAtLow: lo, icerAtHigh: hi, swing: typeof lo === "number" && typeof hi === "number" ? Math.abs(hi - lo) : null }; })(),
    (() => { const v = scenarioIcer((sc) => ({ ...sc, anchor: sc.anchor === "Comparator-rebased" ? "Untreated baseline" : "Comparator-rebased" })); return { parameter: "Admission-rate basis: alternative (untreated baseline vs comparator-rebased)", scope: "Scenario" as const, base: null, low: null, high: null, icerAtLow: v, icerAtHigh: baseIcer, swing: typeof v === "number" && typeof baseIcer === "number" ? Math.abs(v - baseIcer) : null }; })(),
    (() => { const alt = ds.seBuckets.find((b) => has(b.bucket, "Literature-structure"))?.dwDecrement ?? 0.01; const vS = { ...valsOf(bS), dec: alt }; const vC = bC.isNt ? valsOf(bC) : { ...valsOf(bC), dec: alt }; const v = icer(armTotalU(bS, vS), armTotalU(bC, vC)); return { parameter: "SE decrement: literature-structure alternative (0.010 all classes)", scope: "Scenario" as const, base: null, low: null, high: null, icerAtLow: v, icerAtHigh: baseIcer, swing: typeof v === "number" && typeof baseIcer === "number" ? Math.abs(v - baseIcer) : null }; })(),
  ];
  return { subject: S.name, comparator: compName, baseIcer, rows: [...rows, ...extras] };
}
