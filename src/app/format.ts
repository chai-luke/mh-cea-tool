import { USE_CATEGORIES, type AnalysisResult, type CeBasis, type CeStatus, type HeadlineLabel, type ProductResult, type Scenario, type UseCategory } from "../engine";
import { BASE } from "./store";

export const fmtNum = (x: number, d = 2) => x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Money with adaptive precision: 3 dp under 1, 2 dp under 100, whole units above. */
export function money(x: number | null | undefined, sym = "$", d?: number): string {
  if (x == null || Number.isNaN(x)) return "—";
  const a = Math.abs(x);
  const digits = d ?? (a < 1 ? 3 : a < 100 ? 2 : 0);
  return (x < 0 ? "−" : "") + sym + fmtNum(a, digits);
}
/** Unit prices: more precision for cents. */
export function price(x: number | null | undefined, sym = "$"): string {
  if (x == null || Number.isNaN(x)) return "—";
  const a = Math.abs(x);
  return (x < 0 ? "−" : "") + sym + fmtNum(a, a < 0.1 ? 4 : a < 10 ? 3 : 2);
}
export const pct = (x: number | null | undefined, d = 0) => (x == null || Number.isNaN(x) ? "—" : fmtNum(x * 100, d) + "%");
export const num = (x: number | null | undefined, d = 2) => (x == null || Number.isNaN(x) ? "—" : fmtNum(x, d));
export const int = (x: number | null | undefined) => (x == null || Number.isNaN(x) ? "—" : fmtNum(Math.round(x), 0));
export const dalys = (x: number | null | undefined) => (x == null || Number.isNaN(x) ? "—" : fmtNum(x, 4));

/** Display format for user-input cells: #,### / #,###.00; percentages as plain numbers (60 = 60%). */
export function fmtInput(v: number | null | undefined, pctMode?: boolean): string {
  if (v == null || Number.isNaN(v)) return "";
  const x = pctMode ? v * 100 : v;
  const a = Math.abs(x);
  if (a >= 1000) return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (a >= 1) return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (a === 0) return "0";
  return String(+x.toPrecision(4));
}
export function parseInput(t: string): number | null {
  const s = t.trim().replace(/,/g, "").replace(/%$/, "").replace(/^[$₦R]|^Br|^FRw|^GH₵/, "");
  if (s === "") return null;
  const v = Number(s);
  return Number.isNaN(v) ? null : v;
}

export function headlineText(h: HeadlineLabel | number | "" | null | undefined, sym = "$"): string {
  if (h == null || h === "") return "—";
  if (typeof h === "number") return money(h, sym, 0) + "/DALY";
  return h;
}
export const ratioText = (ratio: number | null | undefined) => {
  if (ratio == null) return "";
  return ratio >= 1 ? `×${fmtNum(ratio, ratio >= 10 ? 0 : ratio >= 2 ? 1 : 2)}` : `−${fmtNum((1 - ratio) * 100, ratio < 0.01 ? 1 : 0)}%`;
};

export function statusChip(status: CeStatus | "" | null | undefined): { cls: string; label: string } {
  switch (status) {
    case "Very CE": return { cls: "c-grn", label: "Very cost-effective" };
    case "CE": return { cls: "c-tea", label: "Cost-effective" };
    case "Not CE": return { cls: "c-red", label: "Not cost-effective" };
    case "Current tx": return { cls: "c-sla", label: "Current treatment" };
    case "Dominated": return { cls: "c-gry", label: "Dominated" };
    case "Dominant (cost-saving)": return { cls: "c-grn", label: "Dominant (cost-saving)" };
    case "SW quadrant": return { cls: "c-amb", label: "SW quadrant" };
    default: return { cls: "c-gry", label: "Excluded" };
  }
}
export function basisChip(basis: CeBasis | "" | null | undefined): { cls: string; label: string } {
  switch (basis) {
    case "Current tx": return { cls: "c-sla", label: "Current treatment" };
    case "Dominant (cost-saving)": return { cls: "c-grn", label: "Dominant (cost-saving)" };
    case "Dominated": return { cls: "c-gry", label: "Dominated" };
    case "Less costly, less effective": return { cls: "c-amb", label: "SW quadrant" };
    case "Incremental": return { cls: "c-tea", label: "Incremental" };
    default: return { cls: "c-gry", label: "—" };
  }
}
export const tierClass = (t: string | null | undefined) => (t === "T1" ? "c-grn" : t === "T2" ? "c-tea" : t === "T3" ? "c-gry" : t === "T4" ? "c-amb" : "c-gry");

/** Use-category palette shared with the Excel model. */
export function ucMeta(uc: string | null | undefined): { key: "im" | "m" | "trs" | "ac" | ""; short: string; label: string } {
  const u = (uc ?? "").toLowerCase();
  if (u.startsWith("initiation")) return { key: "im", short: "Init. + maint.", label: "Initiation + Maintenance" };
  if (u === "maintenance") return { key: "m", short: "Maintenance", label: "Maintenance" };
  if (u.startsWith("treatment")) return { key: "trs", short: "Treatment-resistant", label: "Treatment-resistant" };
  if (u.startsWith("acute")) return { key: "ac", short: "Acute agitation", label: "Acute agitation" };
  return { key: "", short: uc ?? "", label: uc ?? "" };
}
export const ucChipClass = (uc: string | null | undefined) => { const k = ucMeta(uc).key; return k ? `uc-${k}` : "c-gry"; };
export const ucTintClass = (uc: string | null | undefined) => { const k = ucMeta(uc).key; return k ? `tint-${k}` : ""; };
export const ucLineClass = (uc: string | null | undefined) => { const k = ucMeta(uc).key; return k ? `line-${k}` : ""; };
export const UC_LINE: Record<string, string> = { im: "#3B82F6", m: "#11D9AE", trs: "#8B5CF6", ac: "#F59E0B" };
export const ucColour = (uc: string | null | undefined) => UC_LINE[ucMeta(uc).key] ?? "#B9C2CE";

export function shortName(n: string): string {
  return n.replace(" (IM, short-acting)", " (IM)").replace(" decanoate", " dec.").replace(" palmitate", "").replace("Cobenfy (KarXT)", "Cobenfy");
}

/** Display order (owner decision 18 Sep 2026): by indicated use (Initiation + Maintenance → Maintenance → Treatment-resistant →
 *  Acute agitation), then class (first-generation → second-generation → novel), then A to Z. Every product list in the tool except
 *  the ranked table uses it, so products sit next to the products they compete with. Rows that carry no use/class (medicine-cost,
 *  efficacy and side-effect rows) are looked up by Int_ID in the base library. Display only: the engine keeps Library order. */
const BASE_LIB = new Map(BASE.interventions.map((iv) => [iv.intId, iv]));
export interface Orderable { intId?: string; name?: string | null; use?: string | null; category?: string | null }
const useOf = (r: Orderable): string | null => r.use ?? (r.intId ? BASE_LIB.get(r.intId)?.use ?? null : null);
const classOf = (r: Orderable): string => r.category ?? (r.intId ? BASE_LIB.get(r.intId)?.category ?? "" : "");
const USE_RANK: Record<string, number> = { im: 0, m: 1, trs: 2, ac: 3, "": 9 };
const classRank = (c: string) => (/^FGA/i.test(c) ? 0 : /^SGA/i.test(c) ? 1 : 2);
export function compareDisplay(a: Orderable, b: Orderable): number {
  return (USE_RANK[ucMeta(useOf(a)).key] - USE_RANK[ucMeta(useOf(b)).key]) || (classRank(classOf(a)) - classRank(classOf(b))) || (a.name ?? "").localeCompare(b.name ?? "", "en");
}
export function sortDisplay<T extends Orderable>(rows: T[]): T[] { return [...rows].sort(compareDisplay); }
/** Product names in display order. */
export const namesInDisplayOrder = (products: Orderable[]) => sortDisplay(products).map((p) => p.name ?? "");
/** Indicated-use label of a row (the group header text). */
export const useLabelOf = (r: Orderable) => ucMeta(useOf(r)).label;
/** option → indicated-use label, for grouped pickers. */
export const groupLabels = (rows: Orderable[]): Record<string, string> => Object.fromEntries(rows.map((r) => [r.name ?? "", useLabelOf(r)]));
/** The comparator in effect per indicated use: the Setup override, else the country grid; "No treatment" for every use in that mode. */
export function comparatorsInEffect(s: Scenario, r: AnalysisResult): Record<string, string> {
  const out: Record<string, string> = {};
  for (const uc of USE_CATEGORIES) out[uc] = s.comparator === "Current treatment" ? ((s.comparatorOverrides[uc] ?? null) || r.countryInputs.gridComparators[uc] || "—") : "No treatment";
  return out;
}

/** Dashboard display order: cost-effective/dominant first, then current treatment, then SW quadrant, then not cost-effective, then dominated; within a group by engine rank. */
export function displayRanked(ranked: ProductResult[]): ProductResult[] {
  const grp = (p: ProductResult) => p.ceStatus === "Dominant (cost-saving)" || p.ceStatus === "Very CE" || p.ceStatus === "CE" ? 0 : p.ceStatus === "Current tx" ? 1 : p.ceStatus === "SW quadrant" ? 2 : p.ceStatus === "Not CE" ? 3 : p.ceStatus === "Dominated" ? 4 : 5;
  return [...ranked].sort((a, b) => grp(a) - grp(b) || (a.rank ?? 1e9) - (b.rank ?? 1e9));
}

export const emlMark = (v: string | null | undefined) => (v === "Yes" ? "✓" : "");

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}
export const csvCell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export type Uc = UseCategory;
