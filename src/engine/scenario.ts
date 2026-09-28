// Scenario tab: economically justifiable price (EJP) per product, head-to-head detail, EJP matrix.
import type { Dataset } from "./dataset";
import { analyze } from "./core";
import type { AnalysisResult, EjpRow, HeadToHeadResult, HeadlineLabel, Scenario, ThresholdMethod } from "./types";
import { COUNTRIES } from "./types";

const eq = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
/** No unit price ≥ 0 makes the product cost-effective against its comparator: either it delivers no more health
 *  (Dominated / SW quadrant), or even at zero price its staffing, inpatient and side-effect costs exceed what the
 *  threshold justifies. Displayed as "no break-even" (17 Sep 2026; was "not cost-effective at any price"). */
const NOT_CE = "no break-even";

export function riskScale(r: AnalysisResult): number {
  const inp = r.scenario.admissionsRiskInput;
  return typeof inp === "number" && r.countryInputs.admissionProb > 0 ? inp / r.countryInputs.admissionProb : 1;
}

export function ejpTable(r: AnalysisResult): EjpRow[] {
  const s = r.scenario;
  const lambda = r.threshold.value;
  const cpi = 1;
  const adm = s.includeAdmin ? s.adminPct : 0;
  const scale = riskScale(r);
  const fullCourse = s.costing === "Full course (incl. wastage)";
  const byName = new Map(r.products.map((p) => [p.name.toLowerCase(), p]));
  return r.products.map((p) => {
    const row: EjpRow = { product: p.name, use: p.use, comparator: p.comparator, defaultUnitPrice: p.price.unitPrice, ejpPerUnit: "", ejpPerYear: null, ejpPctOfDefault: null, ceLabel: p.ceStatus, note: "" };
    if (eq(p.comparator, p.name)) { row.ejpPerUnit = "Reference"; return row; }
    if (p.deltaDalys == null || p.compTotal == null || lambda == null) { row.note = p.deltaDalys == null ? "excluded" : ""; return row; }
    const isNt = eq(p.comparator, "No treatment");
    const admc = isNt ? 0 : adm;
    const icomp = isNt ? r.noTreatment.inpatient : (byName.get(p.comparator.toLowerCase())?.inpatient ?? 0);
    const tstar = p.compTotal + (scale - 1) * icomp * (1 + admc) * cpi + lambda * p.deltaDalys;
    const adh = fullCourse ? 1 : p.adherence;
    const denom = p.annualUnits * adh;
    const ejp = denom > 0 ? (tstar / cpi / (1 + adm) - (p.hrhInitial + p.hrhMaintenance + p.inpatient * scale + p.seCost)) / denom : 0;
    if (ejp <= 0) {
      row.ejpPerUnit = NOT_CE;
      row.note = p.deltaDalys <= 0
        ? "Delivers no more health than the comparator, so no price makes it cost-effective."
        : "Even free, its staffing, inpatient and side-effect costs exceed what the threshold justifies against the comparator.";
    } else {
      row.ejpPerUnit = ejp;
      row.ejpPerYear = ejp * p.annualUnits * adh;
      row.ejpPctOfDefault = p.price.unitPrice !== 0 ? ejp / p.price.unitPrice : null;
      // SW-quadrant products (less health, lower cost): the figure is the price at which the savings offset the health loss.
      row.note = p.deltaDalys < 0 ? "SW break-even — price at which savings offset the health loss" : "";
    }
    return row;
  });
}

export function headToHead(r: AnalysisResult, aName: string, bName: string): HeadToHeadResult | null {
  const s = r.scenario;
  const lambda = r.threshold.value;
  const cpi = 1;
  const adm = s.includeAdmin ? s.adminPct : 0;
  const scale = riskScale(r);
  const fullCourse = s.costing === "Full course (incl. wastage)";
  const arm = (name: string) => {
    if (eq(name, "No treatment")) {
      const nt = r.noTreatment;
      return { name: "No treatment", isNt: true, F: 0, G: 0, H: 0, I: nt.inpatient, J: 0, K: 0, L: nt.total, U: 0, units: 0, adh: 0, price: 0 };
    }
    const p = r.products.find((x) => eq(x.name, name));
    if (!p) return null;
    return { name: p.name, isNt: false, F: p.medCosted, G: p.hrhInitial, H: p.hrhMaintenance, I: p.inpatient, J: p.seCost, K: p.admin, L: p.total, U: p.netDalys, units: p.annualUnits, adh: fullCourse ? 1 : p.adherence, price: p.price.unitPrice };
  };
  const A = arm(aName); const B = arm(bName);
  if (!A || !B) return null;
  const total = (x: NonNullable<ReturnType<typeof arm>>) => x.L + (scale - 1) * x.I * (1 + (x.isNt ? 0 : adm)) * cpi;
  const tA = total(A); const tB = total(B);
  const dC = tA - tB; const dD = A.U - B.U;
  let icer: HeadToHeadResult["icer"];
  if (eq(A.name, B.name)) icer = "Reference" as HeadlineLabel;
  else if (dD < 0 && dC < 0) icer = "(less costly, less effective)";
  else if (dC <= 0 && dD >= 0) icer = "(dominant, cost-saving)";
  else if (dC >= 0 && dD <= 0) icer = "(dominated)";
  else icer = dC / dD;
  const inmb = lambda != null ? dD * lambda - dC : null;
  let verdict = "";
  if (typeof icer !== "number") verdict = "see quadrant label";
  else if (lambda != null) verdict = icer <= lambda / 3 ? "Very CE" : icer <= lambda ? "CE" : "Not CE";
  const totalAStar = lambda != null ? tB + lambda * (A.U - B.U) : null;
  const denom = A.units * A.adh;
  const pStar = totalAStar != null && denom > 0 ? (totalAStar / cpi / (1 + adm) - (A.G + A.H + A.I * scale + A.J)) / denom : null;
  let interpretation = "";
  if (pStar != null) interpretation = pStar <= 0 ? "Not cost-effective at any price at this threshold" : dD < 0 ? "Price at which A's savings offset the health loss at the threshold (SW break-even)" : "Maximum price at which A is cost-effective vs B at this threshold";
  return {
    a: A.name, b: B.name,
    rows: [
      { label: "Medication", a: A.F, b: B.F }, { label: "HRH — initial", a: A.G, b: B.G }, { label: "HRH — maintenance", a: A.H, b: B.H },
      { label: "Inpatient", a: A.I * scale, b: B.I * scale }, { label: "Side-effect mgmt", a: A.J, b: B.J }, { label: "Admin overhead", a: A.K, b: B.K },
      { label: "TOTAL cost", a: tA, b: tB }, { label: "Net DALYs averted", a: A.U, b: B.U },
    ],
    deltaCost: dC, deltaDalys: dD, icer, inmb, verdict, totalAStar,
    breakEvenUnitPrice: pStar, medCostAtPStar: pStar != null ? pStar * A.units * A.adh : null,
    pStarPctOfDefault: pStar != null && A.price !== 0 ? pStar / A.price : null, interpretation,
  };
}

export const MATRIX_PRODUCTS = ["Risperidone (LAI)", "Paliperidone palmitate (LAI)", "Fluphenazine decanoate (LAI)", "Haloperidol decanoate (LAI)"];

export interface MatrixCell { country: string; thresholdMethod: ThresholdMethod; thresholdValue: number | null; anchor: Scenario["anchor"]; comparator: string; ejp: Record<string, number | string> }

/** EJP matrix computed live: countries x thresholds (country default + 1x GDP; SA adds National) x anchor, for the four LAIs. */
export function ejpMatrix(base: Scenario, ds: Dataset): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const country of COUNTRIES) {
    const methods: ThresholdMethod[] = country === "South Africa" ? ["Ochalek (supply-side)", "1x GDP per capita", "National (SA domestic)"] : ["Ochalek (supply-side)", "1x GDP per capita"];
    for (const m of methods) for (const anchor of ["Comparator-rebased", "Untreated baseline"] as Scenario["anchor"][]) {
      const s: Scenario = { ...base, country, thresholdMethod: m, anchor, comparatorOverrides: {}, mortalityScenario: false, mortalityProductLayers: false };
      const r = analyze(s, ds);
      const table = ejpTable(r);
      const ejp: Record<string, number | string> = {};
      for (const name of MATRIX_PRODUCTS) { const row = table.find((x) => x.product === name); ejp[name] = row ? row.ejpPerUnit : ""; }
      const maint = r.countryInputs.gridComparators["Maintenance"];
      cells.push({ country, thresholdMethod: m, thresholdValue: r.threshold.value, anchor, comparator: maint, ejp });
    }
  }
  return cells;
}
