import { useRef, useState } from "react";
import { COUNTRIES, USE_CATEGORIES, dosing, hierarchyDefault, resolvePrice, type Country, type Dataset } from "../../engine";
import { useStore, type SourcePage } from "../store";
import { Callout, Chip, Combo, Eyebrow, Hint, Notes, Title, UcChip } from "../components";
import { P, editsUnder } from "../edits";
import { downloadText, fmtInput, groupLabels, money, namesInDisplayOrder, num, pct, price, sortDisplay } from "../format";
import { NumCell, SelectCell, SrcPage, WithheldChip } from "./Editable";
import { DISCLOSE_WITHHELD, PUBLIC_BUILD, WITHHELD_NOTE, withheldAt, withheldUnder } from "../publicBuild";

export const SOURCE_PAGES: { id: SourcePage; label: string; holds: string; prefixes: string[] }[] = [
  { id: "medicine-costs", label: "Medicine costs", holds: "Unit prices for all 24 products with the provenance tier per country (T1 in-country procurement → T4 global benchmark), the dosing that turns them into annual units, and the price-basis rule.", prefixes: ["medCosts", "selectedPriceBasis", "frequencyPerYear"] },
  { id: "staffing", label: "Staffing costs", holds: "Who delivers care and what each cadre's time costs: salary, on-costs, hours, cost per minute by country.", prefixes: ["hrhUnitCosts"] },
  { id: "protocols", label: "Clinical protocols", holds: "Visit schedules by product, visit type and country: provider, minutes per visit, visits per year.", prefixes: ["hrhProtocols"] },
  { id: "efficacy", label: "Efficacy", holds: "Treatment effects (standardised mean differences vs placebo) with citations and the trial-adherence reference.", prefixes: ["efficacy"] },
  { id: "side-effects", label: "Side-effect profiles", holds: "Class-level side-effect disability decrements and annual management costs; product-to-class mapping.", prefixes: ["seBuckets", "seProductMap", "seCostDetail"] },
  { id: "inpatient", label: "Hospitalisation & effect chain", holds: "Admission probability, length of stay and bed-day cost by country; treatment effect on admission (class RR 0.43; clozapine 0.30, olanzapine 0.35, quetiapine 0.55); transfer factor and GBD residual floor; mortality scenario inputs.", prefixes: ["inpatient", "admissionRrOnTreatment", "mortality", "effectParams", "disabilityWeights", "transferFactors", "rrByFormulationLegacy"] },
  { id: "demand", label: "Demand & epidemiology", holds: "Prevalence, diagnosis/initiation/retention rates, demand-model read-offs, country medication budgets and product-mix defaults. The Budget Impact page is a medication budget (medication costs only).", prefixes: ["funnel", "mixDefaults", "acuteAssumptions"] },
  { id: "thresholds", label: "Thresholds & FX", holds: "Cost-effectiveness threshold menu (Ochalek, Pichon-Riviere, GDP per capita, national) in 2026 USD, and exchange rates.", prefixes: ["thresholds"] },
  { id: "comparators", label: "Comparators", holds: "Current-treatment product per country and clinical use: the reference every ICER is quoted against.", prefixes: ["comparatorGrid"] },
  { id: "library", label: "Product library", holds: "Clinical use, EML status, panel recommendation and administrations per year for injectables.", prefixes: ["interventions"] },
];

export function Sources() {
  const { srcPage } = useStore();
  switch (srcPage) {
    case "medicine-costs": return <MedicineCosts />;
    case "staffing": return <Staffing />;
    case "protocols": return <Protocols />;
    case "efficacy": return <Efficacy />;
    case "side-effects": return <SideEffects />;
    case "inpatient": return <Inpatient />;
    case "demand": return <Demand />;
    case "thresholds": return <Thresholds />;
    case "comparators": return <Comparators />;
    case "library": return <Library />;
    default: return <SourcesIndex />;
  }
}

// ------------------------------------------------------------------ data status (auto-generated)

interface Flag { page: SourcePage; level: "red" | "amber"; text: string }
export function dataFlags(ds: Dataset): Flag[] {
  const out: Flag[] = [];
  if (PUBLIC_BUILD && DISCLOSE_WITHHELD) {
    for (const p of SOURCE_PAGES) {
      const k = withheldUnder(p.prefixes);
      const srcs = p.id === "medicine-costs" ? PUBLIC_BUILD.withheldSourceCount ?? 0 : 0;
      if (k || srcs) out.push({ page: p.id, level: "amber", text: `Public version: ${[srcs ? `${srcs} price source${srcs === 1 ? "" : "s"}` : "", k ? `${k} input value${k === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ")} withheld pending country data clearance. Withheld prices fall through to the next public tier; withheld inputs are blank until you enter your own value.` });
    }
  }
  for (const c of COUNTRIES) {
    const weak = ds.medCosts.filter((m) => { const t = m.tiers[c]?.tier; return t === "T3" || t === "T4" || !t; });
    if (weak.length) out.push({ page: "medicine-costs", level: "amber", text: `${c}: ${weak.length} of ${ds.medCosts.length} prices are proxies or benchmarks (T3/T4): ${weak.map((m) => m.name.replace(/ \(.*\)/, "")).filter((v, i, a) => a.indexOf(v) === i).join(", ")}.` });
  }
  for (const f of ds.funnel) {
    if (!COUNTRIES.includes(f.country as Country)) continue;
    if (f.budgetScopeVerified !== "Yes") out.push({ page: "demand", level: "amber", text: `${f.country}: current medication budget scope unverified (${f.currentBudgetUsd != null ? money(f.currentBudgetUsd, "$", 0) : "blank"}): budget headroom is suppressed until a verified figure is entered.` });
    if (f.currentBudgetUsd && f.sqMedCostUsd && f.currentBudgetUsd / f.sqMedCostUsd > 500) out.push({ page: "demand", level: "red", text: `${f.country}: current budget (${money(f.currentBudgetUsd, "$", 0)}) is ${Math.round(f.currentBudgetUsd / f.sqMedCostUsd).toLocaleString()}× the demand model's status-quo medication cost (${money(f.sqMedCostUsd, "$", 0)}): scale or scope mismatch in the demand model.` });
    if (f.treatedRetainedSq == null && !withheldAt(`funnel/${ds.funnel.indexOf(f)}/treatedRetainedSq`)) out.push({ page: "demand", level: "amber", text: `${f.country}: demand-model reference rows (people treated, funding rate) not yet read off: coverage % and funding rows show “—”.` });
    if ((f.note ?? "").toUpperCase().includes("PENDING")) out.push({ page: "demand", level: "amber", text: `${f.country}: ${f.note}` });
  }
  const protoMissing: Record<string, number> = {};
  for (const p of ds.hrhProtocols) for (const c of COUNTRIES) { const provs = (p.byCountry[c]?.providers ?? []).filter((q) => q.provider); if (!provs.length || provs.every((q) => q.timeMin == null)) protoMissing[c] = (protoMissing[c] ?? 0) + 1; }
  for (const [c, n] of Object.entries(protoMissing)) out.push({ page: "protocols", level: n > 24 ? "red" : "amber", text: `${c}: ${n} of ${ds.hrhProtocols.length} product × visit-type protocol rows have no provider minutes: those visits cost zero.` });
  for (const u of ds.hrhUnitCosts) if (COUNTRIES.includes(u.country as Country) && (!u.costPerMinClean || /placeholder|provisional|assumption/i.test(u.source ?? ""))) out.push({ page: "staffing", level: "amber", text: `${u.country} · ${u.provider}: ${!u.costPerMinClean ? "cost per minute is zero" : "provisional"}: ${u.source ?? "no source"}.` });
  for (const e of ds.efficacy) if (e.smd == null || /pending|assum/i.test(e.smdSource ?? "")) out.push({ page: "efficacy", level: "amber", text: `${e.name}: ${e.smd == null ? "no effect size" : "effect size pending figure-level recheck"}: ${e.smdSource ?? ""}.` });
  for (const r of ds.inpatient) if (COUNTRIES.includes(r.country as Country) && /schiz/i.test(r.condition) && /amber|provisional|pending|placeholder|estimate/i.test(r.source ?? "")) out.push({ page: "inpatient", level: "amber", text: `${r.country}: admission inputs provisional: ${r.source}.` });
  for (const t of ds.thresholds.national) if (t.usd2026 == null) out.push({ page: "thresholds", level: "amber", text: `${t.country}: no national threshold.` });
  out.push({ page: "comparators", level: "amber", text: "Current-treatment grid awaits validation with country clinical teams (September 2026 workshops)." });
  return out;
}

function SourcesIndex() {
  const { goSrc, edits, clearEdits, exportPack, importPack, dataset, baseDataset } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const n = Object.keys(edits).length;
  const flags = dataFlags(dataset);
  const doExport = (withScenario: boolean) => downloadText(`mh-cea-data-pack-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportPack(withScenario), null, 2), "application/json");
  const onFile = async (f: File | undefined) => { if (!f) return; const err = importPack(await f.text()); setMsg(err ?? `Imported ${f.name}.`); if (fileRef.current) fileRef.current.value = ""; };
  return (
    <section>
      <Title title="Sources" sub="Each source page lists raw values with source tags and notes. Open a page to view or edit; blue values are editable and apply everywhere immediately." />
      <div className="provmeta">Data release <b>{baseDataset.meta.modelVersion}</b> (saved {baseDataset.meta.workbook_saved.replace("T", " ")}) · loaded {baseDataset.meta.extracted.replace("T", " ")}.</div>
      {PUBLIC_BUILD && DISCLOSE_WITHHELD && <Callout><b>Public version.</b> {PUBLIC_BUILD.withheldSourceCount} price sources and {PUBLIC_BUILD.withheldCount} input values are withheld pending country data clearance. Prices fall through to the next public tier (another focus country's published tender, then a global benchmark); other withheld inputs are blank and marked <WithheldChip note={WITHHELD_NOTE} />. Enter your own values on the pages below, or import a data pack with them.</Callout>}
      <Callout>
        <b>Editing.</b> Type over any blue value. Edited cells get a teal ring and a ↺ to restore the default; every page has a "Reset this page" button. Edits are saved in this browser only: to share them, export a <b>data pack</b> (a small JSON file) and import it on another machine or send it to CHAI for the next model release.
      </Callout>
      <div className="btnrow">
        <span className="chip c-tea">{n} value{n === 1 ? "" : "s"} edited</span>
        <button className="btn" onClick={() => doExport(false)}>Export data pack</button>
        <button className="btn ghost" onClick={() => doExport(true)}>Export data pack + settings</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>Import data pack…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {n > 0 && <button className="btn danger" onClick={() => { if (confirm("Restore every source value to the default?")) clearEdits(); }}>Restore all defaults</button>}
        {msg && <span className="hint" style={{ margin: 0 }}>{msg}</span>}
      </div>
      <table style={{ maxWidth: 960 }}>
        <thead><tr><th>Source area</th><th>Data</th><th className="num">Edited</th>{DISCLOSE_WITHHELD && <th className="num">Withheld</th>}</tr></thead>
        <tbody>{SOURCE_PAGES.map((p) => { const k = editsUnder(edits, p.prefixes).length; return <tr key={p.id}><td style={{ whiteSpace: "nowrap" }}><a href="#" onClick={(e) => { e.preventDefault(); goSrc(p.id); }}>{p.label}</a></td><td>{p.holds}</td><td className="num">{k ? <Chip cls="c-tea">{k}</Chip> : <span className="mut">—</span>}</td>{DISCLOSE_WITHHELD && (() => { const w = withheldUnder(p.prefixes) + (p.id === "medicine-costs" ? PUBLIC_BUILD?.withheldSourceCount ?? 0 : 0); return <td className="num">{w ? <Chip cls="c-wh" title={WITHHELD_NOTE}>{w}</Chip> : <span className="mut">—</span>}</td>; })()}</tr>; })}</tbody>
      </table>
      <Eyebrow>Data status: inputs still to be completed, verified or replaced</Eyebrow>
      <Hint>Generated live from the source tables. Red = affects a headline figure; amber = weakens a result or suppresses a display.</Hint>
      <table style={{ maxWidth: 960 }} className="tight">
        <tbody>{flags.map((f, i) => <tr key={i}><td style={{ width: 70 }}><Chip cls={f.level === "red" ? "c-red" : "c-amb"}>{f.level}</Chip></td><td>{f.text}</td><td style={{ whiteSpace: "nowrap" }}><a href="#" onClick={(e) => { e.preventDefault(); goSrc(f.page); }}>{SOURCE_PAGES.find((p) => p.id === f.page)?.label}</a></td></tr>)}</tbody>
      </table>
      {n > 0 && (
        <>
          <Eyebrow>Edited values</Eyebrow>
          <div className="scroll"><table className="tight"><thead><tr><th>Path</th><th className="num">Default</th><th className="num">Edited value</th></tr></thead>
            <tbody>{Object.entries(edits).map(([p, v]) => <tr key={p}><td className="mut" style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>{describePath(p, baseDataset)}</td><td className="num">{fmtAny(getBase(baseDataset, p))}</td><td className="num" style={{ color: "var(--blue)", fontWeight: "bold" }}>{fmtAny(v)}</td></tr>)}</tbody></table></div>
        </>
      )}
      <Notes>Calculation steps are not shown as source tables; the Guide describes them. Values shown as "—" are not held in the data.</Notes>
    </section>
  );
}
const getBase = (ds: unknown, p: string) => p.split("/").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), ds);
const fmtAny = (v: unknown) => (v == null || v === "" ? "blank" : typeof v === "number" ? fmtInput(v) : String(v));
function describePath(p: string, ds: Dataset): string {
  const seg = p.split("/");
  const root = seg[0] as keyof Dataset;
  const arr = ds[root] as unknown;
  if (Array.isArray(arr) && /^\d+$/.test(seg[1] ?? "")) {
    const row = arr[Number(seg[1])] as Record<string, unknown>;
    const label = (row?.name ?? row?.country ?? row?.bucket ?? row?.parameter ?? row?.provider ?? row?.product ?? "") as string;
    const extra = row?.visitType ? ` · ${row.visitType}` : row?.provider && row?.country ? ` · ${row.country}` : "";
    return `${root} › ${label}${extra} › ${seg.slice(2).join(" › ")}`;
  }
  return seg.join(" › ");
}

function CountryPick({ value, onChange }: { value: Country; onChange: (c: Country) => void }) {
  return <select className="sel" value={value} onChange={(e) => onChange(e.target.value as Country)}>{[...COUNTRIES, "Ghana" as Country].map((c) => <option key={c}>{c}</option>)}</select>;
}

// ------------------------------------------------------------------ pages

function MedicineCosts() {
  const { dataset: ds, scenario } = useStore();
  const [country, setCountry] = useState<Country>(scenario.country);
  const cols: [keyof (typeof ds.medCosts)[number]["prices"][string], string][] = [["cheapest", "Cheapest"], ["average", "Average"], ["negotiated", "Negotiated"], ["bestCrossCountry", "Best cross-country"]];
  const usd = { ...scenario, currency: "USD" as const, country };
  const rows = sortDisplay(ds.medCosts.map((m, i) => ({ ...m, i })));
  return (
    <SrcPage title="Medicine costs" sub="Unit prices per country with their source and reliability tier, and the dosing that turns them into an annual cost. Where a product has more than one price source for a country, the highest tier is used by default (T1 in-country procurement → T2 India I/E → T3 focus-country proxy → T4 global benchmark); pick an alternate in the Price source column to run that scenario. Products with a single source fall back to the basis columns: the selected basis if present, else the lowest positive price in the block, else the 'other default'." sheetKeys={["medCosts"]} prefixes={["medCosts", "selectedPriceBasis", "frequencyPerYear"]}>
      <div className="btnrow">Country: <CountryPick value={country} onChange={setCountry} /> &nbsp; Price basis column used first: <SelectCell path="selectedPriceBasis" options={["Cheapest", "Average", "Negotiated", "Best cross-country"]} /></div>
      <Eyebrow>Prices: {country} (USD per unit)</Eyebrow>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Product</th><th>Unit</th><th>Price source</th>{cols.map(([, l]) => <th key={l} className="num">{l}</th>)}<th>Price reliability</th><th>Source</th><th className="num">Other default</th><th className="num">Price in effect</th></tr></thead>
        <tbody>{rows.map((m) => { const pr = resolvePrice(ds, usd, m, 1); const prod = ds.products.find((x) => x.intId === m.intId); const srcs = m.priceSources?.[country] ?? []; const dflt = hierarchyDefault(srcs); const wh = m.withheldSources?.[country] ?? []; return (
          <tr key={m.intId}><td>{m.name}</td><td className="mut">{prod?.costUnit?.replace("per ", "") ?? m.formulation}</td>
            <td>{srcs.length > 1 ? <SelectCell path={P("medCosts", m.i, "selectedSource", country)} options={srcs.map((r) => r.id)} labels={Object.fromEntries(srcs.map((r) => [r.id, `${r.tier} · ${r.label} · ${price(r.priceUsd)}`]))} allowBlank blankLabel={dflt ? `Default: ${dflt.tier} · ${dflt.label} · ${price(dflt.priceUsd)}` : "Default"} width={300} /> : <span className="mut">{srcs.length === 1 ? "single source" : "—"}</span>}{wh.length > 0 && <> <Chip cls="c-wh" title={`${wh.map((w) => `${w.tier} ${w.label}`).join("; ")}. ${WITHHELD_NOTE}.`}>{wh.length} withheld</Chip></>}</td>
            {cols.map(([k]) => <td key={k} className="num"><NumCell path={P("medCosts", m.i, "prices", country, k)} width={76} /></td>)}
            <td><Chip cls={pr.tier === "T1" ? "c-grn" : pr.tier === "T2" ? "c-tea" : pr.tier === "T3" ? "c-gry" : "c-amb"}>{pr.tier ?? "—"}</Chip></td>
            <td className="src">{pr.source ?? ""}</td>
            <td className="num"><NumCell path={P("medCosts", m.i, "otherDefault")} width={76} /></td>
            <td className="num"><b>{price(pr.defaultUnitPrice)}</b><div className="mut" style={{ fontSize: 11 }}>{pr.basisUsed === "tier-default" ? "highest tier" : pr.basisUsed === "selected-source" ? "selected source" : pr.basisUsed}</div></td></tr>); })}</tbody>
      </table></div>
      <Eyebrow>All price sources: {country}</Eyebrow>
      <Hint>Every candidate price the model holds for this country, with its reliability tier and reference. ✓ marks the price in effect. Rows added 17 Sep 2026 from the CHAI pricing review sit alongside the earlier figures, which remain selectable.{DISCLOSE_WITHHELD ? " Grey rows are sources withheld from the public version pending country data clearance; their prices are not included." : ""}</Hint>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Product</th><th></th><th>Source</th><th>Tier</th><th className="num">USD per unit</th><th>Unit</th><th>Reference</th><th>Note</th></tr></thead>
        <tbody>{rows.flatMap((m) => { const srcs = m.priceSources?.[country] ?? []; const wh = m.withheldSources?.[country] ?? []; if (srcs.length < 2 && !wh.length) return []; const pr = resolvePrice(ds, usd, m, 1); return [...srcs.map((r, j) => (
          <tr key={m.intId + r.id}><td>{j === 0 ? m.name : ""}</td><td className="num">{pr.sourceId === r.id ? "✓" : ""}</td><td>{r.label}</td><td><Chip cls={r.tier === "T1" ? "c-grn" : r.tier === "T2" ? "c-tea" : r.tier === "T3" ? "c-gry" : "c-amb"}>{r.tier}</Chip></td>
            <td className="num">{price(r.priceUsd)}</td><td className="mut">{r.unit ?? ""}</td><td className="src" style={{ maxWidth: 320 }}>{r.ref ?? ""}</td><td className="src" style={{ maxWidth: 420 }}>{r.note ?? ""}</td></tr>)), ...wh.map((w, j) => (
          <tr key={m.intId + "wh" + w.id + j} className="whrow"><td>{!srcs.length && j === 0 ? m.name : ""}</td><td /><td>{w.label}</td><td><Chip cls="c-gry">{w.tier}</Chip></td><td className="num"><WithheldChip note={w.note} /></td><td /><td className="src" colSpan={2}>{w.note}.</td></tr>))]; })}</tbody>
      </table></div>
      <Eyebrow>Dosing → annual units</Eyebrow>
      <Hint>Units per administration = dose ÷ strength (rounded up for injectables). Administrations per year = the library's Admin/yr for injectables, else the frequency table.</Hint>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Product</th><th>Formulation</th><th>Injectable</th><th className="num">Strength (mg)</th><th className="num">Dose (mg)</th><th>Frequency</th><th className="num">Units/admin</th><th className="num">Admins/yr</th><th className="num">Annual units</th><th>Dosing source</th></tr></thead>
        <tbody>{rows.map((m) => { const iv = ds.interventions.find((x) => x.intId === m.intId); const d = dosing(ds, iv, m); return (
          <tr key={m.intId}><td>{m.name}</td><td className="mut">{m.formulation}</td><td><SelectCell path={P("medCosts", m.i, "injectable")} options={["Yes", "No"]} /></td>
            <td className="num"><NumCell path={P("medCosts", m.i, "strengthMg")} width={66} /></td><td className="num"><NumCell path={P("medCosts", m.i, "doseMg")} width={66} /></td>
            <td><SelectCell path={P("medCosts", m.i, "frequency")} options={Object.keys(ds.frequencyPerYear)} allowBlank /></td>
            <td className="num">{num(d.unitsPerAdmin, 2)}</td><td className="num">{num(d.adminsPerYr, 0)}</td><td className="num"><b>{num(d.annualUnits, 0)}</b></td><td className="src">{m.dosingSource ?? ""}</td></tr>); })}</tbody>
      </table></div>
      <Eyebrow>Frequency table (administrations per year)</Eyebrow>
      <table style={{ maxWidth: 420 }} className="tight"><tbody>{Object.keys(ds.frequencyPerYear).map((k) => <tr key={k}><td>{k}</td><td className="num"><NumCell path={P("frequencyPerYear", k)} width={66} /></td></tr>)}</tbody></table>
    </SrcPage>
  );
}

function Staffing() {
  const { dataset: ds, setEdit } = useStore();
  return (
    <SrcPage title="Staffing costs" sub="Annual cost of employment converted to a cost per minute of patient contact: cost/min = salary (USD) × (1 + on-costs) ÷ (hours per year × 60). The engine uses the cost-per-minute column, converted to local currency when LCU is selected." sheetKeys={["hrhUnitCosts"]} prefixes={["hrhUnitCosts"]}>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Country</th><th>Provider</th><th className="num">Annual CoE (LCU)</th><th>Currency</th><th className="num">FX</th><th className="num">Work hrs/yr</th><th className="num">On-cost</th><th className="num">Cost/min USD (used)</th><th className="num">Derived from components</th><th>Source</th><th>Notes</th></tr></thead>
        <tbody>{ds.hrhUnitCosts.map((u, i) => {
          const derived = u.annualCoeLcu != null && u.fx && u.workHrsPerYr && u.onCostRate != null ? (u.annualCoeLcu / u.fx) * (1 + u.onCostRate) / (u.workHrsPerYr * 60) : null;
          const differs = derived != null && Math.abs(derived - (u.costPerMinClean ?? 0)) > 1e-9;
          return (
            <tr key={i}><td>{u.country}</td><td>{u.provider}</td><td className="num"><NumCell path={P("hrhUnitCosts", i, "annualCoeLcu")} width={110} /></td><td className="mut">{u.currency}</td><td className="num">{num(u.fx, 2)}</td><td className="num"><NumCell path={P("hrhUnitCosts", i, "workHrsPerYr")} width={64} /></td><td className="num"><NumCell path={P("hrhUnitCosts", i, "onCostRate")} pctMode width={64} /></td><td className="num"><NumCell path={P("hrhUnitCosts", i, "costPerMinClean")} width={90} /></td>
              <td className="num">{derived != null ? <>{num(derived, 4)} {differs && <button className="btn ghost sm" title="Use the value derived from the edited components" onClick={() => setEdit(P("hrhUnitCosts", i, "costPerMinClean"), derived)}>apply</button>}</> : "—"}</td>
              <td className="src">{u.source}</td><td className="src">{u.notes}</td></tr>);
        })}</tbody>
      </table></div>
      <Notes>Edit the salary, hours or on-cost and press <b>apply</b> to carry the derived cost per minute into the engine; or type a cost per minute directly. Only the "Cost/min USD (used)" column drives results.</Notes>
    </SrcPage>
  );
}

function Protocols() {
  const { dataset: ds, scenario } = useStore();
  const [country, setCountry] = useState<Country>(scenario.country);
  const names = namesInDisplayOrder(ds.interventions);
  const [prodName, setProdName] = useState(names[0]);
  const iv = ds.interventions.find((x) => x.name === prodName) ?? ds.interventions[0];
  const intId = iv.intId;
  const injectable = /LAI|IM injection/i.test(iv.formulation ?? "");
  const rows = ds.hrhProtocols.map((p, i) => ({ p, i })).filter(({ p }) => p.intId === intId);
  const providers = Array.from(new Set(ds.hrhUnitCosts.filter((u) => u.country === country).map((u) => u.provider)));
  // the country block's source note sits on the first product's screening row in the data; show it for every product
  const blockSource = ds.hrhProtocols.find((p) => (p.visitType ?? "").startsWith("Initial"))?.byCountry[country]?.source ?? null;
  const used = (p: (typeof rows)[number]["p"]) => (p.byCountry[country]?.providers ?? []).some((x) => typeof x.timeMin === "number" && x.timeMin > 0);
  const visitTitle = (vt: string) => (injectable && vt.startsWith("Medication monitoring") ? "Medication monitoring (the injection visit; one per administration)" : vt);
  return (
    <SrcPage title="Clinical protocols" sub="Minutes of provider time per visit type, and visits per year. Cost per visit = the sum of minutes × each provider's cost per minute. For injectables the monitoring visit is the injection visit, so administration time is costed here and visits per year follow the dosing schedule. A visit type with no minutes is not used in that country's pathway." sheetKeys={["hrhProtocols"]} prefixes={["hrhProtocols"]}>
      <div className="btnrow">Country: <CountryPick value={country} onChange={setCountry} /> &nbsp; Product: <Combo value={prodName} options={names} onChange={(v) => v && setProdName(v)} width={300} groups={groupLabels(ds.interventions)} /></div>
      {blockSource && <Hint><b>{country} pathway source:</b> {blockSource}</Hint>}
      {rows.map(({ p, i }) => (
        <div key={p.visitType}>
          <Eyebrow>{visitTitle(p.visitType ?? "")}{!used(p) && <span className="chip c-gry" style={{ marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>not used in this pathway</span>}</Eyebrow>
          {!used(p) && <Hint>{p.visitType?.startsWith("Initial") ? `No separate screening visit in the ${country} pathway: screening is part of the prescription (initiation) visit, so this row adds no cost. Enter minutes here to add one.` : `No provider time recorded for this visit type in ${country}; it adds no cost.`}</Hint>}
          <table className="tight" style={{ maxWidth: 800 }}>
            <thead><tr><th>#</th><th>Provider</th><th className="num">Minutes</th><th className="num">Visits / yr</th><th className="num">% receiving (not applied)</th></tr></thead>
            <tbody>{[0, 1, 2, 3].map((k) => <tr key={k}><td>{k + 1}</td><td><SelectCell path={P("hrhProtocols", i, "byCountry", country, "providers", k, "provider")} options={providers} allowBlank /></td><td className="num"><NumCell path={P("hrhProtocols", i, "byCountry", country, "providers", k, "timeMin")} width={64} /></td><td className="num"><NumCell path={P("hrhProtocols", i, "byCountry", country, "providers", k, "visitsPerYr")} width={64} /></td><td className="num"><NumCell path={P("hrhProtocols", i, "byCountry", country, "providers", k, "pctReceiving")} pctMode width={64} /></td></tr>)}</tbody>
          </table>
          {p.byCountry[country]?.source && p.byCountry[country]?.source !== blockSource && <div className="hint">Source: {p.byCountry[country]?.source}</div>}
        </div>
      ))}
      <Notes>Rule: the four provider <i>rates</i> are looked up from the provider names on the first product's screening row for the country, and applied positionally (provider 1 to 4) to every product. Change provider names on the first product's Initial screening row to change which rates apply. A provider listed with visits but no minutes (for example a nurse present at an injection visit) adds no cost until minutes are entered.</Notes>
    </SrcPage>
  );
}

function Efficacy() {
  const { dataset: ds } = useStore();
  const rows = sortDisplay(ds.efficacy.map((e, i) => ({ ...e, i })));
  return (
    <SrcPage title="Efficacy" sub="Standardised mean difference (SMD) versus placebo per product; the effect chain multiplies it by the transfer factor and adherence." sheetKeys={["efficacy"]} prefixes={["efficacy"]}>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Product</th><th className="num">SMD (used)</th><th>SMD source</th><th className="num">Huhn 2019 SMD</th><th className="num">Trial adherence ref.</th><th>Adherence source</th><th>Notes</th></tr></thead>
        <tbody>{rows.map((e) => <tr key={e.intId}><td>{e.name}</td><td className="num"><NumCell path={P("efficacy", e.i, "smd")} width={66} /></td><td className="src">{e.smdSource}</td><td className="num">{num(e.smdHuhn2019, 2)}</td><td className="num">{pct(e.adherenceRef)}</td><td className="src">{e.adherenceRefSource}</td><td className="src">{e.notes}</td></tr>)}</tbody>
      </table></div>
    </SrcPage>
  );
}

function SideEffects() {
  const { dataset: ds } = useStore();
  const bucketNames = ds.seBuckets.map((b) => b.bucket);
  const map = sortDisplay(ds.seProductMap.map((m, i) => ({ ...m, i })));
  return (
    <SrcPage title="Side-effect profiles" sub="Each product maps to a class bucket for its disability decrement and for its annual management cost." sheetKeys={["seProfiles"]} prefixes={["seBuckets", "seProductMap", "seCostDetail"]}>
      <Eyebrow>Class buckets</Eyebrow>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Bucket</th><th className="num">DW decrement</th><th className="num">Low</th><th className="num">High</th><th className="num">Mgmt cost USD/yr</th><th>Members and evidence</th></tr></thead>
        <tbody>{ds.seBuckets.map((b, i) => <tr key={b.bucket}><td><b>{b.bucket}</b></td><td className="num"><NumCell path={P("seBuckets", i, "dwDecrement")} width={66} /></td><td className="num"><NumCell path={P("seBuckets", i, "low")} width={62} /></td><td className="num"><NumCell path={P("seBuckets", i, "high")} width={62} /></td><td className="num"><NumCell path={P("seBuckets", i, "mgmtCostUsd")} width={66} /></td><td className="src" style={{ maxWidth: 440 }}>{b.members}{b.sourceNote ? `: ${b.sourceNote}` : ""}</td></tr>)}</tbody>
      </table></div>
      <Eyebrow>Product → bucket mapping</Eyebrow>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Product</th><th>Drug class</th><th>Cost bucket</th><th>Decrement bucket</th><th>Legacy rationale</th></tr></thead>
        <tbody>{map.map((m) => { const iv = ds.interventions.find((x) => x.intId === m.intId); return <tr key={m.intId}><td>{iv?.name ?? m.intId}</td><td className="mut">{m.drugClass}</td><td><SelectCell path={P("seProductMap", m.i, "costBucket")} options={bucketNames} allowBlank /></td><td><SelectCell path={P("seProductMap", m.i, "decrementBucket")} options={bucketNames} allowBlank /></td><td className="src">{m.rationaleLegacy}</td></tr>; })}</tbody>
      </table></div>
      <Eyebrow>Management-cost detail (informational)</Eyebrow>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Drug class</th><th className="num">Metabolic monitoring</th><th className="num">Metabolic tx incidence</th><th className="num">Metabolic tx cost</th><th className="num">EPS incidence</th><th className="num">EPS tx cost</th><th className="num">Other</th><th className="num">Total USD</th><th>Source</th></tr></thead>
        <tbody>{ds.seCostDetail.map((c) => <tr key={c.drugClass}><td>{c.drugClass}</td><td className="num">{money(c.metabolicMonitUsd)}</td><td className="num">{pct(c.metabolicTxIncidence)}</td><td className="num">{money(c.metabolicTxUsd)}</td><td className="num">{pct(c.epsIncidence)}</td><td className="num">{money(c.epsTxUsd)}</td><td className="num">{money(c.otherSeUsd)}</td><td className="num">{money(c.totalSeUsd)}</td><td className="src">{c.source}</td></tr>)}</tbody>
      </table></div>
    </SrcPage>
  );
}

function Inpatient() {
  const { dataset: ds } = useStore();
  const dwIdx = ds.disabilityWeights.map((d, i) => ({ d, i })).filter(({ d }) => /schiz/i.test(d.key));
  return (
    <SrcPage title="Hospitalisation & effect chain" sub="Admission probability, length of stay and bed-day cost per country; relative risks of admission on treatment; transfer factor and disability weights; mortality scenario inputs." sheetKeys={["inpatient", "effectChain"]} prefixes={["inpatient", "admissionRrOnTreatment", "mortality", "effectParams", "disabilityWeights", "transferFactors", "rrByFormulationLegacy"]}>
      <Eyebrow>Admissions and bed-days (schizophrenia)</Eyebrow>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Country</th><th>Condition</th><th className="num">Admission probability /yr</th><th className="num">Length of stay (days)</th><th className="num">Cost per day (LCU)</th><th className="num">FX</th><th className="num">Cost per day (USD, used)</th><th>Source</th></tr></thead>
        <tbody>{ds.inpatient.map((r, i) => <tr key={r.country + r.condition}><td>{r.country}</td><td className="mut">{r.condition}</td><td className="num"><NumCell path={P("inpatient", i, "admissionProb")} width={66} /></td><td className="num"><NumCell path={P("inpatient", i, "losDays")} width={62} /></td><td className="num">{withheldAt(P("inpatient", i, "costPerDayLcu")) ? <WithheldChip note={withheldAt(P("inpatient", i, "costPerDayLcu"))!} /> : num(r.costPerDayLcu, 0)}</td><td className="num">{num(r.fx, 2)}</td><td className="num"><NumCell path={P("inpatient", i, "costPerDayUsd")} width={76} /></td><td className="src">{r.source}</td></tr>)}</tbody>
      </table></div>
      <Eyebrow>Relative risk of admission on treatment (vs no treatment)</Eyebrow>
      <table className="tight" style={{ maxWidth: 960 }}>
        <thead><tr><th>Bucket</th><th className="num">RR</th><th className="num">Low</th><th className="num">High</th><th>Source</th></tr></thead>
        <tbody>{ds.admissionRrOnTreatment.map((r, i) => <tr key={r.bucket ?? i}><td>{r.bucket}</td><td className="num"><NumCell path={P("admissionRrOnTreatment", i, "rr")} width={62} /></td><td className="num"><NumCell path={P("admissionRrOnTreatment", i, "low")} width={62} /></td><td className="num"><NumCell path={P("admissionRrOnTreatment", i, "high")} width={62} /></td><td className="src" style={{ maxWidth: 500 }}>{r.source}</td></tr>)}</tbody>
      </table>
      <Hint>Effective RR per product = 1 − adherence × (1 − RR). Buckets are matched by name: clozapine, olanzapine (any form), quetiapine, else the class default.</Hint>
      <Eyebrow>Transfer factor and disability weights</Eyebrow>
      <table className="tight" style={{ maxWidth: 960 }}>
        <thead><tr><th>Parameter</th><th className="num">Value</th><th className="num">Low</th><th className="num">High</th><th>Source</th></tr></thead>
        <tbody>{ds.effectParams.map((p, i) => <tr key={p.parameter ?? i}><td>{p.parameter}</td><td className="num"><NumCell path={P("effectParams", i, "value")} width={66} /></td><td className="num"><NumCell path={P("effectParams", i, "low")} width={62} /></td><td className="num"><NumCell path={P("effectParams", i, "high")} width={62} /></td><td className="src" style={{ maxWidth: 440 }}>{p.source}</td></tr>)}
          {dwIdx.map(({ d, i }) => <tr key={d.key}><td>Disability weight: {d.state} ({d.key})</td><td className="num"><NumCell path={P("disabilityWeights", i, "dw")} width={66} /></td><td className="num" colSpan={2}>{d.ui95}</td><td className="src">GBD 2021 (Salomon 2015 method)</td></tr>)}
        </tbody>
      </table>
      <Hint>Proportional method: transfer factor = k_prop × baseline DW ("Schizophrenia-Severe"). Absolute method: the schizophrenia (or default) "applied" value below. Cap = baseline DW − DW_residual.</Hint>
      <table className="tight" style={{ maxWidth: 800 }}>
        <thead><tr><th>Condition</th><th className="num">Rating scale</th><th className="num">TTO</th><th className="num">Applied (absolute method)</th><th>Source</th></tr></thead>
        <tbody>{ds.transferFactors.map((t, i) => <tr key={t.condition ?? i}><td>{t.condition}</td><td className="num">{num(t.ratingScale, 3)}</td><td className="num">{num(t.tto, 3)}</td><td className="num"><NumCell path={P("transferFactors", i, "applied")} width={66} /></td><td className="src">{t.source}{t.notes ? `: ${t.notes}` : ""}</td></tr>)}</tbody>
      </table>
      <Eyebrow>Mortality scenario inputs (off in the base case)</Eyebrow>
      <table className="tight" style={{ maxWidth: 960 }}>
        <thead><tr><th>Parameter</th><th className="num">Value</th><th>Source</th></tr></thead>
        <tbody>{ds.mortality.map((p, i) => <tr key={p.parameter ?? i}><td>{p.parameter}</td><td className="num"><NumCell path={P("mortality", i, "value")} width={66} /></td><td className="src" style={{ maxWidth: 560 }}>{p.source}</td></tr>)}</tbody>
      </table>
    </SrcPage>
  );
}

function Demand() {
  const { dataset: ds, scenario } = useStore();
  const [country, setCountry] = useState<Country>(scenario.country);
  const fi = ds.funnel.findIndex((f) => f.country === country);
  const f = ds.funnel[fi];
  const mix = ds.mixDefaults.map((m, i) => ({ m, i })).filter(({ m }) => m.country === country);
  const rowsF: [keyof NonNullable<typeof f>, string, boolean][] = [["adultPop", "Adult population (20+)", false], ["prevalence", "Schizophrenia prevalence (%)", true], ["schizShareOfPsychosis", "Schizophrenia share of non-affective psychosis (%)", true], ["diagnosisRateSq", "Diagnosis rate: status quo (%)", true], ["txInitRateSq", "Treatment-initiation rate: status quo (%)", true], ["retentionSq", "Retention: status quo (%)", true], ["goalCoverageTarget", "Goal coverage target (%)", true], ["currentBudgetUsd", "Current medication budget (USD)", false], ["sqMedCostUsd", "Status-quo medication cost, demand model (USD)", false], ["treatedRetainedSq", "People treated, retained: status quo (reference)", false], ["treatedRetainedGoal", "People treated, retained: goal (reference)", false], ["fundingRatePerPy", "Funding per patient-year, demand model (USD, reference)", false]];
  return (
    <SrcPage title="Demand & epidemiology" sub="The coverage funnel and product-mix defaults that drive the budget impact." sheetKeys={["demand"]} prefixes={["funnel", "mixDefaults", "acuteAssumptions"]}>
      <div className="btnrow">Country: <CountryPick value={country} onChange={setCountry} /></div>
      {f ? (
        <>
          <Eyebrow>Coverage funnel: {country}</Eyebrow>
          <table className="tight" style={{ maxWidth: 680 }}>
            <thead><tr><th>Input</th><th className="num">Value</th></tr></thead>
            <tbody>{rowsF.map(([k, label, isPct]) => <tr key={k}><td>{label}</td><td className="num"><NumCell path={P("funnel", fi, k)} pctMode={isPct} width={120} /></td></tr>)}
              <tr><td>Budget scope verified as antipsychotic medication?</td><td className="num"><SelectCell path={P("funnel", fi, "budgetScopeVerified")} options={["Yes", "No"]} allowBlank /></td></tr>
            </tbody>
          </table>
          <div className="hint">Source: {f.source}{f.note ? ` · ${f.note}` : ""}</div>
          <Eyebrow>Product-mix defaults: {country} (share within use category)</Eyebrow>
          <table className="tight" style={{ maxWidth: 760 }}>
            <thead><tr><th>Use category</th><th>Product</th><th className="num">Raw share</th><th className="num">Normalised share (used)</th><th>Note</th></tr></thead>
            <tbody>{mix.map(({ m, i }) => <tr key={i}><td><UcChip uc={m.useCategory} short /></td><td>{m.product}</td><td className="num">{pct(m.rawShare, 1)}</td><td className="num"><NumCell path={P("mixDefaults", i, "normalizedShare")} pctMode width={76} /></td><td className="src">{m.note}</td></tr>)}</tbody>
          </table>
          {USE_CATEGORIES.map((uc) => { const s = mix.filter(({ m }) => m.useCategory.toLowerCase() === uc.toLowerCase()).reduce((a, { m }) => a + (m.normalizedShare ?? 0), 0); return s ? <span key={uc} className={`chip ${Math.abs(s - 1) < 1e-6 ? "c-grn" : "c-amb"}`} style={{ marginRight: 6 }}>{uc}: Σ {pct(s, 1)}</span> : null; })}
        </>
      ) : <Callout amber>No funnel row for {country}.</Callout>}
      <Eyebrow>Acute-care assumptions (documentation)</Eyebrow>
      <table className="tight" style={{ maxWidth: 960 }}>
        <thead><tr><th>Parameter</th><th className="num">Value</th><th className="num">Low</th><th className="num">High</th><th>Source</th></tr></thead>
        <tbody>{ds.acuteAssumptions.map((p, i) => <tr key={p.parameter ?? i}><td>{p.parameter}</td><td className="num"><NumCell path={P("acuteAssumptions", i, "value")} width={66} /></td><td className="num">{num(p.low, 2)}</td><td className="num">{num(p.high, 2)}</td><td className="src" style={{ maxWidth: 480 }}>{p.source}</td></tr>)}</tbody>
      </table>
    </SrcPage>
  );
}

const WB_CODES: Record<string, string> = { Ethiopia: "ETH", Nigeria: "NGA", Rwanda: "RWA", "South Africa": "ZAF", Ghana: "GHA" };
interface WbRow { country: string; year: string; value: number }

function Thresholds() {
  const { dataset: ds, setEdit } = useStore();
  const [wb, setWb] = useState<WbRow[] | null>(null);
  const [wbMsg, setWbMsg] = useState<string | null>(null);
  const tables: [keyof typeof ds.thresholds, string][] = [["ochalek", "Ochalek (supply-side)"], ["pichonRiviere", "Pichon-Riviere (supply-side)"], ["gdpPerCapita", "1× GDP per capita"], ["national", "National (domestic)"]];
  const fetchWb = async () => {
    setWbMsg("Fetching from the World Bank API…");
    try {
      const codes = Object.values(WB_CODES).join(";");
      const res = await fetch(`https://api.worldbank.org/v2/country/${codes}/indicator/NY.GDP.PCAP.CD?format=json&mrnev=1&per_page=50`);
      const j = (await res.json()) as [unknown, { country: { value: string }; date: string; value: number | null }[]];
      const rows = (j[1] ?? []).filter((x) => x.value != null).map((x) => ({ country: x.country.value, year: x.date, value: x.value as number }));
      setWb(rows); setWbMsg(rows.length ? `Fetched ${rows.length} countries (indicator NY.GDP.PCAP.CD, most recent non-empty value).` : "No data returned.");
    } catch (e) { setWbMsg(`Could not reach the World Bank API (${(e as Error).message}). Offline copies of the tool need an internet connection for this.`); }
  };
  const applyWb = (row: WbRow) => {
    const i = ds.thresholds.gdpPerCapita.findIndex((t) => t.country === row.country);
    if (i < 0) return;
    const t = ds.thresholds.gdpPerCapita[i];
    const ratio = t.gdpUsd && t.usd2026 ? t.usd2026 / t.gdpUsd : 1;
    setEdit(P("thresholds", "gdpPerCapita", i, "gdpUsd"), row.value);
    setEdit(P("thresholds", "gdpPerCapita", i, "year"), Number(row.year));
    setEdit(P("thresholds", "gdpPerCapita", i, "usd2026"), row.value * ratio);
    setEdit(P("thresholds", "gdpPerCapita", i, "source"), `World Bank API NY.GDP.PCAP.CD (${row.year} value fetched ${new Date().toISOString().slice(0, 10)}); 2026-USD uplift ratio ${ratio.toFixed(4)} kept from the data release`);
  };
  return (
    <SrcPage title="Thresholds & FX" sub="Cost-effectiveness thresholds in 2026 USD per DALY, and the national currency rates used when the currency is set to LCU." sheetKeys={["thresholds"]} prefixes={["thresholds"]}>
      {tables.map(([k, label]) => (
        <div key={k}>
          <Eyebrow>{label}</Eyebrow>
          <table className="tight" style={{ maxWidth: 860 }}>
            <thead><tr><th>Country</th><th className="num">Published value (USD)</th><th className="num">Year</th><th className="num">USD 2026 (used)</th><th>Source</th></tr></thead>
            <tbody>{(ds.thresholds[k] as typeof ds.thresholds.ochalek).map((r, i) => <tr key={r.country}><td>{r.country}</td><td className="num">{num(r.valueUsd ?? r.gdpUsd, 0)}</td><td className="num">{r.year ?? "—"}</td><td className="num"><NumCell path={P("thresholds", k, i, "usd2026")} width={90} /></td><td className="src">{r.source}</td></tr>)}</tbody>
          </table>
          {k === "gdpPerCapita" && (
            <div style={{ margin: "6px 0 10px" }}>
              <div className="btnrow"><button className="btn ghost" onClick={fetchWb}>Fetch latest GDP per capita from the World Bank</button>{wbMsg && <span className="hint" style={{ margin: 0 }}>{wbMsg}</span>}</div>
              {wb && wb.length > 0 && (
                <table className="tight" style={{ maxWidth: 640 }}><thead><tr><th>Country</th><th className="num">Latest GDP per capita (current USD)</th><th className="num">Year</th><th /></tr></thead>
                  <tbody>{wb.map((row) => <tr key={row.country}><td>{row.country}</td><td className="num">{num(row.value, 0)}</td><td className="num">{row.year}</td><td><button className="btn ghost sm" onClick={() => applyWb(row)}>Apply (keeps the 2026 uplift ratio)</button></td></tr>)}</tbody></table>
              )}
            </div>
          )}
        </div>
      ))}
      <Eyebrow>Currency rates (LCU per USD)</Eyebrow>
      <table className="tight" style={{ maxWidth: 760 }}>
        <thead><tr><th>Country</th><th>Currency</th><th className="num">LCU per USD</th><th>Source</th></tr></thead>
        <tbody>{ds.thresholds.fx.map((r, i) => <tr key={r.country}><td>{r.country}</td><td className="mut">{r.currency}</td><td className="num"><NumCell path={P("thresholds", "fx", i, "lcuPerUsd")} width={96} /></td><td className="src">{r.source}</td></tr>)}</tbody>
      </table>
    </SrcPage>
  );
}

function Comparators() {
  const { dataset: ds, setEdit, clearEdit, baseDataset } = useStore();
  const names = namesInDisplayOrder(ds.interventions);
  return (
    <SrcPage title="Comparators: current treatment by country and use" sub="The product each country uses most for each clinical use. It is the reference every ICER is quoted against unless overridden on Setup." sheetKeys={["comparators"]} prefixes={["comparatorGrid"]}>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Country</th>{USE_CATEGORIES.map((uc) => <th key={uc}><UcChip uc={uc} /></th>)}</tr></thead>
        <tbody>{ds.comparatorGrid.map((g, i) => <tr key={g.country}><td><b>{g.country}</b></td>{USE_CATEGORIES.map((uc) => { const key = Object.keys(g).find((k) => k.toLowerCase() === uc.toLowerCase()) ?? uc; const path = P("comparatorGrid", i, key); const base = (baseDataset.comparatorGrid[i] as Record<string, string | null>)[key] ?? null; return <td key={uc}><Combo value={(g[key] as string | null) ?? null} options={names} allowBlank blankLabel="— none —" onChange={(v) => (v === base ? clearEdit(path) : setEdit(path, v))} width={240} small /></td>; })}</tr>)}</tbody>
      </table></div>
      <Notes>The Maintenance comparator is the modal oral product in Ethiopia and Nigeria (risperidone) and Rwanda (olanzapine); South Africa keeps zuclopenthixol decanoate. Country clinical teams validate this grid at the September 2026 workshops.</Notes>
    </SrcPage>
  );
}

function Library() {
  const { dataset: ds } = useStore();
  const uses = ["Initiation + maintenance", "Maintenance", "Treatment-resistant", "Acute agitation"];
  const rows = sortDisplay(ds.interventions.map((iv, i) => ({ ...iv, i })));
  return (
    <SrcPage title="Product library" sub="Clinical use (which comparator and cabinet slot a product competes for), essential-medicines status, panel recommendation and administrations per year for injectables. Listed by indicated use, then class, then A to Z; the engine keeps its own library order." sheetKeys={["interventions"]} prefixes={["interventions"]}>
      <div className="scroll"><table className="tight">
        <thead><tr><th>Product</th><th>Class</th><th>Formulation</th><th>Clinical use</th><th className="num">Admin/yr (injectables)</th><th>WHO EML</th>{COUNTRIES.map((c) => <th key={c}>{c} EML</th>)}<th>Panel</th><th>Notes</th></tr></thead>
        <tbody>{rows.map((iv) => <tr key={iv.intId}><td>{iv.name}</td><td className="mut">{iv.category}</td><td className="mut">{iv.formulation}</td><td><SelectCell path={P("interventions", iv.i, "use")} options={uses} /></td><td className="num"><NumCell path={P("interventions", iv.i, "adminPerYr")} width={58} /></td><td>{iv.whoEml ?? "—"}</td>{COUNTRIES.map((c) => <td key={c}><SelectCell path={P("interventions", iv.i, "nationalEml", c)} options={["Yes", "No"]} allowBlank /></td>)}<td><SelectCell path={P("interventions", iv.i, "panelRecommended")} options={["Yes", "No", "Not appraised", "n/a: outside consensus scope"]} allowBlank /></td><td className="src">{iv.notes}</td></tr>)}</tbody>
      </table></div>
      <Notes>Products marked panel "No" are excluded from cabinet slots (shown as not panel-recommended) but remain in the ranking. Sources: {ds.interventions[0]?.source}.</Notes>
    </SrcPage>
  );
}
