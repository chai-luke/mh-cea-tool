import { useMemo, useState, Fragment } from "react";
import { ejpMatrix, ejpTable, headToHead, MATRIX_PRODUCTS, USE_CATEGORIES } from "../../engine";
import { useStore } from "../store";
import { Chip, Combo, Eyebrow, Hint, Notes, NumInput, SettingsLine, Title, UcChip, Viz } from "../components";
import { Dumbbell, TwoArmBars } from "../charts";
import { compareDisplay, comparatorsInEffect, dalys, groupLabels, money, namesInDisplayOrder, price, ratioText, shortName, statusChip, useLabelOf } from "../format";
import { SCEN } from "../content";

export function ScenarioScreen() {
  const { result: r, scenario: s, setScenario, dataset } = useStore();
  const sym = r.currencySymbol;
  const lambda = r.threshold.value;
  const byName = new Map(r.products.map((p) => [p.name, p]));
  const table = useMemo(() => ejpTable(r).filter((t) => t.ejpPerUnit !== "Reference" && byName.get(t.product)?.included).sort((a, b) => compareDisplay(byName.get(a.product)!, byName.get(b.product)!)), [r]);
  const comps = comparatorsInEffect(s, r);
  const groups = groupLabels(r.products);
  const names = ["No treatment", ...namesInDisplayOrder(r.products)];
  const hh = useMemo(() => headToHead(r, s.headToHead.a, s.headToHead.b), [r, s.headToHead]);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const matrix = useMemo(() => (matrixOpen ? ejpMatrix(s, dataset) : []), [matrixOpen, s, dataset]);
  const dumb = table.filter((t) => typeof t.ejpPerUnit === "number" && t.defaultUnitPrice > 0)
    .map((t) => ({ label: shortName(t.product), from: t.defaultUnitPrice, to: t.ejpPerUnit as number, tag: ratioText(t.ejpPctOfDefault), up: (t.ejpPctOfDefault ?? 0) >= 1 }))
    .sort((a, b) => (b.to / b.from) - (a.to / a.from));
  const ejpChip = (t: (typeof table)[number]) => {
    if (typeof t.ejpPerUnit === "string" && t.ejpPerUnit) return <Chip cls="c-red" title={SCEN.naNote}>no break-even</Chip>;
    if (typeof t.ejpPerUnit === "number") return (t.ejpPctOfDefault ?? 0) >= 1 ? <Chip cls="c-grn">headroom {ratioText(t.ejpPctOfDefault)}</Chip> : <Chip cls="c-amb">needs a cut {ratioText(t.ejpPctOfDefault)}</Chip>;
    return <Chip cls="c-gry">excluded</Chip>;
  };
  const sameUse = (a: string | null | undefined, uc: string) => (a ?? "").toLowerCase().startsWith(uc.toLowerCase().slice(0, 9));
  const missingUses = USE_CATEGORIES.filter((uc) => !table.some((t) => sameUse(t.use, uc)))
    .map((uc) => ({ uc, ref: r.products.find((p) => p.included && sameUse(p.use, uc) && p.headline === "Reference")?.name }));
  const scale = typeof s.admissionsRiskInput === "number" && r.countryInputs.admissionProb > 0 ? s.admissionsRiskInput / r.countryInputs.admissionProb : 1;
  return (
    <section>
      <Title title={SCEN.title} />
      <SettingsLine />
      <table className="settings" style={{ maxWidth: 900 }}><tbody>
        <tr><td><b>CE threshold</b></td><td>{lambda != null ? money(lambda, sym, 2) + " per DALY" : r.threshold.flag}</td><td className="mut">{r.threshold.method}</td></tr>
        <tr><td><b>Expected admissions per patient-year</b></td><td><NumInput value={s.admissionsRiskInput} onChange={(v) => setScenario({ admissionsRiskInput: v })} width={80} placeholder={String(r.countryInputs.admissionProb)} /> <span className="mut">{s.country} default: {r.countryInputs.admissionProb}</span></td><td className="mut" title={SCEN.riskTitle}>{SCEN.riskHint}{scale !== 1 && <> Scale applied to the inpatient term: ×{scale.toFixed(2)}.</>}</td></tr>
      </tbody></table>

      <Eyebrow>1. CE price by product</Eyebrow>
      <Hint>{SCEN.ejpIntro} Products serving as {s.comparator.toLowerCase()} are the reference and are not listed.</Hint>
      <Viz title="Default price vs cost-effective price" src="Log price axis. Each line runs from the default price (○) to the cost-effective price (●): green = the price could rise; amber = it needs a cut. Right column = the ratio; hover a line for the values. Products with no break-even price appear only in the table." style={{ marginBottom: 12 }}>
        <Dumbbell rows={dumb} sym={sym} />
      </Viz>
      <div className="scroll">
        <table>
          <thead><tr><th>Product</th><th>Use category</th><th>Compared with</th><th className="num">Default unit price</th><th className="num">EJP per unit</th><th className="num">EJP per year</th><th>EJP as % of default</th><th>CE label at default price</th><th>Note</th></tr></thead>
          <tbody>{table.map((t, idx) => { const st = statusChip(t.ceLabel); const label = useLabelOf(byName.get(t.product)!); const newGroup = idx === 0 || useLabelOf(byName.get(table[idx - 1].product)!) !== label; return (<Fragment key={t.product}>
            {newGroup && <tr className="grp"><td colSpan={9}><UcChip uc={label} /><span className="mut">compared with <b>{comps[label] ?? "—"}</b></span></td></tr>}
            <tr><td>{t.product}</td><td><UcChip uc={t.use} /></td><td className="mut">{t.comparator}</td><td className="num">{price(t.defaultUnitPrice, sym)}</td>
              <td className="num"><b>{typeof t.ejpPerUnit === "number" ? price(t.ejpPerUnit, sym) : t.ejpPerUnit ? <span className="mut" title={SCEN.naNote}>no break-even</span> : "—"}</b></td>
              <td className="num">{t.ejpPerYear != null ? money(t.ejpPerYear, sym, 2) : "—"}</td><td>{ejpChip(t)}</td><td><Chip cls={st.cls}>{st.label}</Chip></td><td className="src">{t.note}</td></tr></Fragment>); })}
          </tbody>
        </table>
      </div>
      {missingUses.length > 0 && <Hint>{missingUses.map(({ uc, ref }) => <span key={uc} style={{ display: "block", marginTop: 4 }}><UcChip uc={uc} /> {ref ? <>{ref} is the current treatment for this use, so it is the reference and has no cost-effective price to show.</> : <>no included product other than the reference.</>}</span>)}</Hint>}
      <Hint>{SCEN.naNote}</Hint>
      <Notes><p><b>How to read the cost-effective price</b></p>{SCEN.notes.map(([k, v]) => <p key={k}><b>{k}</b>: {v}</p>)}</Notes>

      <Eyebrow>2. Head-to-head detail: pairwise comparison and break-even</Eyebrow>
      <Hint>{SCEN.hhIntro}</Hint>
      <table className="settings" style={{ maxWidth: 700 }}><tbody>
        <tr><td><b>Product A</b></td><td><Combo value={s.headToHead.a} options={names} onChange={(v) => v && setScenario({ headToHead: { ...s.headToHead, a: v } })} width={300} groups={groups} /></td></tr>
        <tr><td><b>Comparator B</b></td><td><Combo value={s.headToHead.b} options={names} onChange={(v) => v && setScenario({ headToHead: { ...s.headToHead, b: v } })} width={300} groups={groups} /></td></tr>
      </tbody></table>
      <div className="split">
        <Viz title="Per patient-year, side by side">
          {hh && <TwoArmBars sym={sym}
            a={{ name: hh.a, total: hh.rows[6].a, parts: [["Medication", hh.rows[0].a], ["HRH", hh.rows[1].a + hh.rows[2].a], ["Inpatient", hh.rows[3].a], ["Side-effect mgmt", hh.rows[4].a], ["Admin overhead", hh.rows[5].a]] }}
            b={{ name: hh.b, total: hh.rows[6].b, parts: [["Medication", hh.rows[0].b], ["HRH", hh.rows[1].b + hh.rows[2].b], ["Inpatient", hh.rows[3].b], ["Side-effect mgmt", hh.rows[4].b], ["Admin overhead", hh.rows[5].b]] }} />}
        </Viz>
        <Viz title="Result">
          {hh ? (
            <table><tbody>
              <tr><td>Net DALYs averted (A · B)</td><td className="num">{dalys(hh.rows[7].a)} · {dalys(hh.rows[7].b)}</td></tr>
              <tr><td>Δ Cost (A − B)</td><td className="num"><b>{(hh.deltaCost >= 0 ? "+" : "−") + money(Math.abs(hh.deltaCost), sym, 2)}</b></td></tr>
              <tr><td>Δ DALYs (A − B)</td><td className="num">{(hh.deltaDalys >= 0 ? "+" : "−") + dalys(Math.abs(hh.deltaDalys))}</td></tr>
              <tr><td>ICER / quadrant</td><td className="num">{typeof hh.icer === "number" ? money(hh.icer, sym, 0) + "/DALY" : hh.icer}</td></tr>
              <tr><td>Incremental NMB at threshold</td><td className="num">{hh.inmb != null ? (hh.inmb >= 0 ? "+" : "−") + money(Math.abs(hh.inmb), sym, 2) : "—"}</td></tr>
              <tr><td>CE verdict vs threshold</td><td className="num"><Chip cls={hh.verdict === "Not CE" ? "c-red" : hh.verdict === "Very CE" ? "c-grn" : hh.verdict === "CE" ? "c-tea" : "c-sla"}>{hh.verdict === "Not CE" ? "Not cost-effective" : hh.verdict === "Very CE" ? "Very cost-effective" : hh.verdict === "CE" ? "Cost-effective" : typeof hh.icer === "string" ? hh.icer : hh.verdict}</Chip></td></tr>
              <tr><td>p*: break-even unit price for A</td><td className="num"><b>{hh.breakEvenUnitPrice == null ? "—" : hh.breakEvenUnitPrice <= 0 ? "none: no break-even" : price(hh.breakEvenUnitPrice, sym)}</b></td></tr>
              {hh.breakEvenUnitPrice != null && hh.breakEvenUnitPrice > 0 && <><tr><td>Annual medication cost at p*</td><td className="num">{money(hh.medCostAtPStar, sym, 2)}</td></tr><tr><td>p* as % of current default price</td><td className="num">{hh.pStarPctOfDefault != null ? ratioText(hh.pStarPctOfDefault) : "—"}</td></tr></>}
              <tr><td colSpan={2} className="mut">{hh.interpretation}. {SCEN.hhFoot}</td></tr>
            </tbody></table>
          ) : <div className="hint">Pick two products.</div>}
        </Viz>
      </div>

      <Eyebrow>3. EJP matrix: LAIs across countries, thresholds and admission-rate bases</Eyebrow>
      <Hint>EJP per unit vs each product's own-category comparator (the country's Maintenance current treatment); comparator overrides blank; hospitalisation channel on; proportional transfer factor with GBD floor; mortality off; consumed-dose costing; USD. Computed live from the current source data.</Hint>
      <details onToggle={(e) => setMatrixOpen((e.target as HTMLDetailsElement).open)}>
        <summary style={{ cursor: "pointer", fontWeight: "bold", color: "var(--slate)", fontSize: 14 }}>Show matrix</summary>
        {matrixOpen && (
          <div className="scroll"><table className="tight">
            <thead><tr><th>Country</th><th>Threshold method</th><th className="num">Threshold (USD)</th><th>Admission-rate basis</th><th>Maintenance comparator</th>{MATRIX_PRODUCTS.map((n) => <th key={n} className="num">{shortName(n)}</th>)}</tr></thead>
            <tbody>{matrix.map((c, i) => <tr key={i}><td>{c.country}</td><td className="mut">{c.thresholdMethod.replace(" (supply-side)", "")}</td><td className="num">{c.thresholdValue != null ? money(c.thresholdValue, "$", 0) : "—"}</td><td className="mut">{c.anchor === "Comparator-rebased" ? "Derived from comparator" : "Observed = untreated"}</td><td className="mut">{shortName(c.comparator)}</td>
              {MATRIX_PRODUCTS.map((n) => { const v = c.ejp[n]; return <td key={n} className="num">{typeof v === "number" ? price(v) : v === "Reference" ? "Ref." : v ? <span className="mut" title={SCEN.naNote}>n/a</span> : "—"}</td>; })}</tr>)}</tbody>
          </table></div>
        )}
      </details>
    </section>
  );
}
