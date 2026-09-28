import { useMemo } from "react";
import { budgetImpact, USE_CATEGORIES, type MixBasis, type UseCategory } from "../../engine";
import { useStore } from "../store";
import { Callout, Chip, Combo, Eyebrow, Hint, Legend, Notes, NumInput, Sel, SettingsLine, Title, UcChip, Viz } from "../components";
import { StackedBars } from "../charts";
import { groupLabels, int, money, namesInDisplayOrder, pct, shortName, ucColour, ucTintClass } from "../format";
import { BIA } from "../content";

const BASIS_LABEL: Record<MixBasis, string> = { "Current tx (incumbent)": "Default (country product mix)", "CE-optimised": "CE-optimised (drug cabinet)" };

export function Budget() {
  const { result: r, scenario: s, setBia, dataset, go } = useStore();
  const b = s.bia; const sym = r.currencySymbol;
  const res = useMemo(() => budgetImpact(r, dataset), [r, dataset]);
  const f = dataset.funnel.find((x) => x.country === s.country);
  const allNames = namesInDisplayOrder(r.products);
  const groups = groupLabels(r.products);
  const splitSum = USE_CATEGORIES.reduce((a, uc) => a + (b.splits[uc] ?? 0), 0);
  if (!res.applicable) return <section><Title title={BIA.title} sub={BIA.sub} /><Callout amber>The demand model has no funnel data for {s.country} yet, so the budget impact cannot be computed. Add adult population, prevalence and the coverage funnel under Sources → Demand &amp; epidemiology.</Callout></section>;
  const sq = res.funnel[0], goal = res.funnel[1], funded = res.funnel[2];
  const verified = res.currentBudgetVerified && res.currentBudget != null;
  const showFunded = verified; // Funded = Today whenever there is no verified budget, so the column only adds noise then
  const gap = (budget: number) => (verified ? res.currentBudget! - budget : null);
  const kpiCell = (v: number | null) => v == null ? <span className="mut">—</span> : <b style={{ color: v >= 0 ? "#15803D" : "var(--redink)" }}>{(v >= 0 ? "+" : "−") + money(Math.abs(v), sym, 0)}</b>;
  const cols = ["#334155", "#11D9AE", "#8B5CF6", "#F59E0B"];
  const ucCols = res.slots.map((x) => ucColour(x.useCategory));
  const setUserPct = (product: string, uc: UseCategory, within: number | null) => { const split = b.splits[uc] ?? 0; setBia({ productShareOverrides: { ...b.productShareOverrides, [product]: within == null ? null : within * split } }); };
  const addProduct = (uc: UseCategory, name: string | null) => { if (!name) return; setBia({ extraProducts: { ...b.extraProducts, [uc]: [...(b.extraProducts[uc] ?? []), name] } }); };
  const removeProduct = (uc: UseCategory, name: string) => { const ov = { ...b.productShareOverrides }; delete ov[name]; setBia({ extraProducts: { ...b.extraProducts, [uc]: (b.extraProducts[uc] ?? []).filter((x) => x !== name) }, productShareOverrides: ov }); };
  const fundingReq = (py: number) => (res.demandReference.fundingRatePerPy != null ? res.demandReference.fundingRatePerPy * r.fx * py : null);
  const budgetLabel = b.costBasis === "Total" ? "Health-system cost of the selected mix" : "Medicine budget for the selected mix";
  const colHead = <tr><th /><th className="num">Today</th>{showFunded && <th className="num">Funded</th>}<th className="num">At coverage goal</th></tr>;
  return (
    <section>
      <Title title={BIA.title} sub={BIA.sub} />
      <SettingsLine />
      <Hint>{BIA.howToRead}</Hint>

      <Eyebrow>Budget impact at a glance</Eyebrow>
      <table style={{ maxWidth: 760 }}>
        <thead>{colHead}</thead>
        <tbody>
          <tr><td>Patient-years on treatment</td><td className="num">{int(res.totals.sqPatientYears)}</td>{showFunded && <td className="num">{int(res.totals.fundedPatientYears)}</td>}<td className="num">{int(res.totals.goalPatientYears)}</td></tr>
          <tr><td><b>{budgetLabel}</b></td><td className="num"><b>{money(res.totals.sqBudget, sym, 0)}</b></td>{showFunded && <td className="num"><b>{money(res.totals.fundedBudget, sym, 0)}</b></td>}<td className="num"><b>{money(res.totals.goalBudget, sym, 0)}</b></td></tr>
          <tr><td>Cost per patient-year</td><td className="num">{money(res.kpi.costPerPatientYear, sym, 2)}</td>{showFunded && <td className="num">{money(res.totals.fundedPatientYears ? res.totals.fundedBudget / res.totals.fundedPatientYears : null, sym, 2)}</td>}<td className="num">{money(res.totals.goalPatientYears ? res.totals.goalBudget / res.totals.goalPatientYears : null, sym, 2)}</td></tr>
          <tr><td>Current medicine budget</td><td className="num" colSpan={showFunded ? 3 : 2} style={{ textAlign: "right" }}>{verified ? money(res.currentBudget, sym, 0) : <span className="mut">no verified antipsychotic budget; enter one under Inputs to see headroom</span>}</td></tr>
          <tr><td>Budget headroom (+) or gap (−)</td><td className="num">{kpiCell(gap(res.totals.sqBudget))}</td>{showFunded && <td className="num">{kpiCell(gap(res.totals.fundedBudget))}</td>}<td className="num">{kpiCell(gap(res.totals.goalBudget))}</td></tr>
          <tr><td>Share of current budget</td><td className="num">{verified ? pct(res.totals.sqBudget / res.currentBudget!) : "—"}</td>{showFunded && <td className="num">{verified ? pct(res.totals.fundedBudget / res.currentBudget!) : "—"}</td>}<td className="num">{verified ? pct(res.totals.goalBudget / res.currentBudget!) : "—"}</td></tr>
        </tbody>
      </table>
      {showFunded && <Hint>Funded = Today scaled by MIN(current budget ÷ the demand model's status-quo medicine cost, 1){f?.sqMedCostUsd != null ? `; here ${money(res.currentBudget, sym, 0)} against ${money(f.sqMedCostUsd * r.fx, sym, 0)}` : ""}. It equals Today whenever the budget already covers that cost.</Hint>}

      <Eyebrow>1. Inputs</Eyebrow>
      <table className="settings" style={{ maxWidth: 1000 }}><tbody>
        <tr><td><b>Country</b></td><td>{s.country} · {s.currency}</td><td className="mut">Select country and currency on <a href="#" onClick={(e) => { e.preventDefault(); go("setup"); }}>Setup</a>.</td></tr>
        <tr><td><b>Medicine costing</b></td><td><Sel value={b.adherenceApplied ? "Consumed doses" : "Full course"} options={["Consumed doses", "Full course"] as const} onChange={(v) => setBia({ adherenceApplied: v === "Consumed doses" })} /></td><td className="mut">{BIA.costingNote}</td></tr>
        <tr><td><b>Cost scope</b></td><td><Sel value={b.costBasis} options={["Medication only", "Total"] as const} onChange={(v) => setBia({ costBasis: v })} labels={{ "Medication only": "Medicines only", "Total": "Full health-system cost" }} /></td><td className="mut">{BIA.costBasisNote}</td></tr>
        <tr><td><b>Product mix</b></td><td><Sel value={b.mixBasis} options={["Current tx (incumbent)", "CE-optimised"] as const} onChange={(v) => setBia({ mixBasis: v as MixBasis, mixBasisByCategory: {} })} labels={BASIS_LABEL} /></td><td className="mut">{BIA.mixBasisNote}</td></tr>
        <tr><td><b>Coverage today (diagnosis rate)</b></td><td><NumInput value={b.diagnosisRateSqOverride} pctMode onChange={(v) => setBia({ diagnosisRateSqOverride: v })} width={72} placeholder={pct(f?.diagnosisRateSq, 1)} /> <span className="mut">%</span></td><td className="mut">Demand model: {pct(f?.diagnosisRateSq, 1)} of people with psychosis diagnosed today (indicative range {pct((f?.diagnosisRateSq ?? 0) * 0.75, 1)} to {pct(Math.min(1, (f?.diagnosisRateSq ?? 0) * 1.25), 1)}). Blank = the demand model's rate.</td></tr>
        <tr><td><b>Coverage goal</b></td><td><NumInput value={b.goalCoverageOverride} pctMode onChange={(v) => setBia({ goalCoverageOverride: v })} width={72} placeholder={pct(f?.goalCoverageTarget, 0)} /> <span className="mut">%</span></td><td className="mut">Demand model target: {pct(f?.goalCoverageTarget, 0)} (range {pct((f?.goalCoverageTarget ?? 0) * 0.75, 0)} to {pct(Math.min(1, (f?.goalCoverageTarget ?? 0) * 1.15), 0)}). Each funnel step is set to the cube root of the target.</td></tr>
        <tr><td><b>Wastage and buffer</b></td><td><NumInput value={b.wastage} pctMode onChange={(v) => setBia({ wastage: v ?? 0.15 })} width={72} /> <span className="mut">%</span></td><td className="mut">{BIA.wastageNote} Default 15% (range 10 to 20%).</td></tr>
        <tr><td><b>Current medicine budget ({s.currency})</b></td><td><NumInput value={b.currentBudgetUsd} onChange={(v) => setBia({ currentBudgetUsd: v })} width={120} placeholder={f?.currentBudgetUsd != null && f?.budgetScopeVerified === "Yes" ? money(f.currentBudgetUsd * r.fx, sym, 0) : "enter budget"} /></td><td className="mut">{BIA.budgetNote} {f?.budgetScopeVerified === "Yes" && f?.currentBudgetUsd != null ? <>Sourced default {money(f.currentBudgetUsd * r.fx, sym, 0)} (national antipsychotic procurement forecast, verified scope; provenance on Sources → Demand &amp; epidemiology).</> :<span className="warn" title={f?.currentBudgetUsd != null ? "A sourced figure exists but its scope is not verified as antipsychotic procurement; it is not used or shown." : undefined}>No verified antipsychotic budget for {s.country} yet; the Funded column and headroom appear once one is entered.</span>}</td></tr>
      </tbody></table>
      <Hint>{BIA.keyParamsFoot}</Hint>

      <Eyebrow>2. Product mix by indicated use (editable)</Eyebrow>
      <Hint>{BIA.mixIntro}</Hint>
      <div className="split">
        {res.slots.map((slot) => {
          const uc = slot.useCategory;
          const lines = res.productLines.filter((l) => l.useCategory === uc);
          const sum = lines.reduce((a, l) => a + l.effectiveShare, 0);
          const extras = new Set(b.extraProducts[uc] ?? []);
          const inTable = new Set(lines.map((l) => l.product));
          return (
            <div className="viz" key={uc} style={{ borderTop: `4px solid ${ucColour(uc)}` }}>
              <h4><UcChip uc={uc} /> <span className="mut" style={{ fontSize: 13 }}>· {pct(slot.split)} of patient-years</span></h4>
              <table className="tight"><tbody>
                <tr><td className="mut" style={{ width: 150 }}>Basis in effect</td><td colSpan={3}><b>{BASIS_LABEL[slot.basis]}</b></td></tr>
                <tr><td className="mut">Basis override</td><td colSpan={3}><Sel value={(b.mixBasisByCategory[uc] ?? "") as "" | MixBasis} options={["", "Current tx (incumbent)", "CE-optimised"] as const} labels={{ "": "as the global setting", ...BASIS_LABEL }} onChange={(v) => setBia({ mixBasisByCategory: { ...b.mixBasisByCategory, [uc]: (v || null) as MixBasis | null } })} /></td></tr>
                <tr><td className="mut">Category weight</td><td colSpan={3}><NumInput value={b.splits[uc]} pctMode onChange={(v) => setBia({ splits: { ...b.splits, [uc]: v ?? 0 } })} width={64} /> <span className="mut">% of all patient-years</span></td></tr>
              </tbody></table>
              <table className="tight">
                <thead><tr><th>Product</th><th className="num">Default %</th><th className="num">User %</th><th className="num">Effective %</th></tr></thead>
                <tbody>{lines.map((l) => (
                  <tr key={l.product} className={ucTintClass(uc)}>
                    <td>{shortName(l.product)} {extras.has(l.product) && <button className="rst" title="Remove from this table" onClick={() => removeProduct(uc, l.product)} style={{ border: "none", background: "none", color: "var(--redink)", cursor: "pointer" }}>×</button>}</td>
                    <td className="num">{pct(l.defaultShare, 1)}</td>
                    <td className="num"><NumInput value={b.productShareOverrides[l.product] != null ? (slot.split > 0 ? b.productShareOverrides[l.product]! / slot.split : 0) : null} pctMode onChange={(v) => setUserPct(l.product, uc, v)} width={64} /></td>
                    <td className="num">{pct(l.effectiveShare, 1)}</td>
                  </tr>))}
                  <tr><td colSpan={3} className="mut">Total effective share (must be 100%)</td><td className="num"><Chip cls={Math.abs(sum - 1) < 1e-6 ? "c-grn" : "c-amb"}>{Math.abs(sum - 1) < 1e-6 ? "✓" : "⚠"} {pct(sum, 0)}</Chip></td></tr>
                </tbody>
              </table>
              <div className="btnrow" style={{ margin: "6px 0 0" }}><span className="mut" style={{ fontSize: 13 }}>Add product:</span> <Combo value={null} options={allNames.filter((n) => !inTable.has(n))} onChange={(v) => addProduct(uc, v)} placeholder="type to search…" width={240} small groups={groups} /></div>
            </div>
          );
        })}
      </div>
      <div className="hint" style={{ marginTop: 6 }}>Category weights: {USE_CATEGORIES.map((uc) => `${uc} ${pct(b.splits[uc] ?? 0)}`).join(" · ")}; total <Chip cls={Math.abs(splitSum - 1) < 1e-6 ? "c-grn" : "c-amb"}>{pct(splitSum, 0)}</Chip></div>

      <Eyebrow>3. Results by indicated use and by product</Eyebrow>
      <div className="split">
        <Viz title={`${budgetLabel} by scenario, stacked by indicated use (${sym})`} src={verified ? "Dashed line = current medicine budget." : "Enter a verified current budget under Inputs to show the budget line."}>
          <StackedBars sym={sym} segmentLabels={res.slots.map((x) => x.useCategory)} colours={ucCols} labelWidth={80} barHeight={24}
            rows={[{ label: "Today", segments: res.slots.map((x) => x.sqBudget) }, ...(showFunded ? [{ label: "Funded", segments: res.slots.map((x) => x.fundedBudget) }] : []), { label: "At goal", segments: res.slots.map((x) => x.goalBudget) }]}
            refLine={verified ? { value: res.currentBudget!, label: `current budget ${money(res.currentBudget, sym, 0)}` } : null} />
          <Legend items={res.slots.map((x, i) => [ucCols[i], x.useCategory] as [string, string])} />
        </Viz>
        <Viz title={`Spend by product today (${sym})`} src="Each product in the mix, coloured by indicated use.">
          <StackedBars sym={sym} segmentLabels={res.slots.map((x) => x.useCategory)} colours={cols} labelWidth={126} barHeight={16}
            rows={[...res.productLines].filter((l) => l.sqBudget > 0).sort((a, c) => c.sqBudget - a.sqBudget).map((l) => ({ label: shortName(l.product), segments: res.slots.map((x) => (x.useCategory === l.useCategory ? l.sqBudget : 0)) }))} />
        </Viz>
      </div>
      <table>
        <thead><tr><th>Indicated use</th><th>Product</th><th className="num">Share of category</th><th className="num">Unit price</th><th className="num">Units per patient-year</th><th className="num">Procurement {sym} per patient-year</th><th className="num">Today</th>{showFunded && <th className="num">Funded</th>}<th className="num">At coverage goal</th></tr></thead>
        <tbody>
          {res.productLines.map((l) => <tr key={l.useCategory + l.product} className={ucTintClass(l.useCategory)}><td><UcChip uc={l.useCategory} /></td><td>{l.product}</td><td className="num">{pct(l.effectiveShare, 1)}</td><td className="num">{money(l.unitPrice, sym, l.unitPrice < 1 ? 4 : 2)}</td><td className="num">{int(l.units)}</td><td className="num">{money(l.procurementPerPtYr, sym, 2)}</td><td className="num">{money(l.sqBudget, sym, 0)}</td>{showFunded && <td className="num">{money(l.fundedBudget, sym, 0)}</td>}<td className="num">{money(l.goalBudget, sym, 0)}</td></tr>)}
          <tr><td colSpan={6}><b>Total</b></td><td className="num"><b>{money(res.totals.sqBudget, sym, 0)}</b></td>{showFunded && <td className="num"><b>{money(res.totals.fundedBudget, sym, 0)}</b></td>}<td className="num"><b>{money(res.totals.goalBudget, sym, 0)}</b></td></tr>
        </tbody>
      </table>
      <Notes>{BIA.formula}</Notes>

      <Eyebrow>4. Demand model reference</Eyebrow>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: "bold", color: "var(--slate)", fontSize: 14 }}>Show the demand estimates behind the patient-year figures</summary>
        <table style={{ maxWidth: 760 }} className="tight">
          <thead><tr><th>Metric</th><th className="num">Today</th>{showFunded && <th className="num">Funded</th>}<th className="num">At coverage goal</th></tr></thead>
          <tbody>
            <tr className="refrow"><td>Psychosis need (prevalent adults 20+)</td><td className="num">{int(res.epiNeed)}</td>{showFunded && <td className="num">{int(res.epiNeed)}</td>}<td className="num">{int(res.epiNeed)}</td></tr>
            <tr><td>Coverage (retained ÷ need)</td><td className="num">{res.demandReference.treatedRetainedSq != null ? pct(res.demandReference.treatedRetainedSq / res.epiNeed, 1) : "—"}</td>{showFunded && <td className="num">—</td>}<td className="num">{res.demandReference.treatedRetainedGoal != null ? pct(res.demandReference.treatedRetainedGoal / res.epiNeed, 1) : "—"}</td></tr>
            <tr><td>People treated (retained at year end)</td><td className="num">{int(res.demandReference.treatedRetainedSq)}</td>{showFunded && <td className="num">—</td>}<td className="num">{int(res.demandReference.treatedRetainedGoal)}</td></tr>
            <tr className="refrow"><td>Effective patient-years</td><td className="num">{int(sq.effectivePatientYears)}</td>{showFunded && <td className="num">{int(funded.effectivePatientYears)}</td>}<td className="num">{int(goal.effectivePatientYears)}</td></tr>
            <tr className="refrow"><td>People initiating treatment</td><td className="num">{int(sq.initiating)}</td>{showFunded && <td className="num">{int(funded.initiating)}</td>}<td className="num">{int(goal.initiating)}</td></tr>
            <tr><td>Funding requirement ({s.currency})</td><td className="num">{money(fundingReq(sq.effectivePatientYears), sym, 0)}</td>{showFunded && <td className="num">{money(fundingReq(funded.effectivePatientYears), sym, 0)}</td>}<td className="num">{money(fundingReq(goal.effectivePatientYears), sym, 0)}</td></tr>
            <tr><td>Funding per person treated</td><td className="num">{res.demandReference.treatedRetainedSq ? money((fundingReq(sq.effectivePatientYears) ?? 0) / res.demandReference.treatedRetainedSq, sym, 2) : "—"}</td>{showFunded && <td className="num">—</td>}<td className="num">{res.demandReference.treatedRetainedGoal ? money((fundingReq(goal.effectivePatientYears) ?? 0) / res.demandReference.treatedRetainedGoal, sym, 2) : "—"}</td></tr>
            <tr className="refrow"><td>Funding rate ({sym} per patient-year, demand model)</td><td className="num">{res.demandReference.fundingRatePerPy != null ? money(res.demandReference.fundingRatePerPy * r.fx, sym, 2) : "—"}</td>{showFunded && <td className="num">—</td>}<td className="num">—</td></tr>
          </tbody>
        </table>
        <Hint>{BIA.demandFoot}</Hint>
      </details>
    </section>
  );
}
