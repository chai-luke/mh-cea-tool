import { COUNTRIES, USE_CATEGORIES, type Country, type Scenario, type ThresholdMethod, type UseCategory } from "../../engine";
import { useStore } from "../store";
import { Combo, Eyebrow, Hint, NumInput, Sel, Title, UcChip, YesNo } from "../components";
import { groupLabels, money, namesInDisplayOrder, ucTintClass } from "../format";
import { SETUP } from "../content";

const THRESHOLDS: ThresholdMethod[] = ["Ochalek (supply-side)", "Pichon-Riviere (supply-side)", "1x GDP per capita", "National (SA domestic)", "Custom"];

export function Setup() {
  const { scenario: s, setScenario, setCountry, result, resetScenario, go } = useStore();
  const sym = result.currencySymbol;
  const t = result.threshold;
  const grid = result.countryInputs.gridComparators;
  const names = namesInDisplayOrder(result.products);
  const groups = groupLabels(result.products);
  const setAdh = (k: keyof Scenario["adherence"], v: number | null) => setScenario({ adherence: { ...s.adherence, [k]: v ?? s.adherence[k] } });
  const anyOverride = Object.values(s.comparatorOverrides).some((v) => v);
  return (
    <section>
      <Title title={SETUP.title} sub={<>{SETUP.sub} Blue = editable; everything else is calculated. Products and prices are on the <a href="#" onClick={(e) => { e.preventDefault(); go("products"); }}>Products</a> page.</>} />
      <Eyebrow>Select model settings</Eyebrow>
      <table className="settings" style={{ maxWidth: 900 }}>
        <tbody>
          <tr><td><b>Country</b></td><td><Sel value={s.country} options={COUNTRIES} onChange={(v) => setCountry(v as Country)} /></td><td className="mut">{SETUP.country}</td></tr>
          <tr><td><b>Comparator</b></td><td><Sel value={s.comparator} options={["Current treatment", "No treatment"] as const} onChange={(v) => setScenario({ comparator: v })} /></td><td className="mut">{SETUP.comparator}</td></tr>
          <tr><td><b>Currency</b></td><td><Sel value={s.currency} options={["USD", "LCU"] as const} onChange={(v) => setScenario({ currency: v })} /></td><td className="mut">{SETUP.currency} Rate in use: {result.fx === 1 ? "1.00" : result.fx.toLocaleString("en-US", { maximumFractionDigits: 2 })} per USD.</td></tr>
        </tbody>
      </table>

      {s.comparator === "Current treatment" && (
        <>
          <Eyebrow>{SETUP.ctTitle(s.country)}</Eyebrow>
          <Hint>{SETUP.ctSub} Type to search (for example “halo”) or pick from the list. Blank = the country default shown in the last column.</Hint>
          <table style={{ maxWidth: 780 }}>
            <thead><tr><th>Indicated use</th><th>User selection</th><th>Default</th></tr></thead>
            <tbody>
              {USE_CATEGORIES.map((uc) => (
                <tr key={uc} className={ucTintClass(uc)}>
                  <td><UcChip uc={uc} /></td>
                  <td><Combo value={s.comparatorOverrides[uc] ?? null} options={names} allowBlank blankLabel={`Default: ${grid[uc] || "none"}`} onChange={(v) => setScenario({ comparatorOverrides: { ...s.comparatorOverrides, [uc as UseCategory]: v } })} width={300} groups={groups} /></td>
                  <td className="mut">{grid[uc] || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="btnrow"><button className="btn ghost" disabled={!anyOverride} onClick={() => setScenario({ comparatorOverrides: {} })}>Select default treatments</button></div>
        </>
      )}

      <Eyebrow>{SETUP.analysisTitle}</Eyebrow>
      <Hint>{SETUP.analysisHint}</Hint>
      <table className="settings" style={{ maxWidth: 900 }}>
        <tbody>
          <tr><td><b>CE threshold method</b></td><td><Sel value={s.thresholdMethod} options={THRESHOLDS} onChange={(v) => setScenario({ thresholdMethod: v })} /></td><td className="mut">{SETUP.threshold}</td></tr>
          {s.thresholdMethod === "Custom" && <tr><td><b>Custom CE threshold</b></td><td><NumInput value={s.customThreshold} onChange={(v) => setScenario({ customThreshold: v })} placeholder="USD per DALY" /></td><td className="mut">{SETUP.custom}</td></tr>}
          <tr><td><b>Threshold in effect</b></td><td>{t.value != null ? <><b>{money(t.value, sym, 2)}</b> per DALY averted</> : <span className="warn">{t.flag}</span>}</td><td className="mut">{SETUP.inEffect} {t.source ? <>Source: {t.source}.</> : null}</td></tr>
          <tr><td><b>Include admin costs?</b></td><td><YesNo value={s.includeAdmin} onChange={(v) => setScenario({ includeAdmin: v })} /></td><td className="mut">{SETUP.admin}</td></tr>
          {s.includeAdmin && <tr><td><b>Admin overhead</b></td><td><NumInput value={s.adminPct} pctMode onChange={(v) => setScenario({ adminPct: v ?? 0.12 })} width={70} /> <span className="mut">%</span></td><td className="mut">Share of direct costs added for administration.</td></tr>}
          <tr><td><b>Medication costing</b></td><td><Sel value={s.costing} options={["Consumed doses only", "Full course (incl. wastage)"] as const} onChange={(v) => setScenario({ costing: v })} /></td><td className="mut">{SETUP.costing}</td></tr>
        </tbody>
      </table>

      <Eyebrow>{SETUP.methodTitle}</Eyebrow>
      <Hint>{SETUP.methodHint}</Hint>
      <table className="settings" style={{ maxWidth: 900 }}>
        <tbody>
          <tr><td><b>Hospitalisation channel</b></td><td><YesNo value={s.hospChannel} onChange={(v) => setScenario({ hospChannel: v })} /></td><td className="mut">{SETUP.channel}</td></tr>
          {s.hospChannel && <tr><td><b>Admission-rate basis</b></td><td><Sel value={s.anchor} options={["Comparator-rebased", "Untreated baseline"] as const} onChange={(v) => setScenario({ anchor: v })} labels={SETUP.admBasisLabels} /></td><td className="mut">{SETUP.admBasis}</td></tr>}
          <tr><td><b>Transfer factor method</b></td><td><Sel value={s.tfMethod} options={["Proportional", "Absolute (Andrews literal)"] as const} onChange={(v) => setScenario({ tfMethod: v })} labels={SETUP.tfLabels} /></td><td className="mut">{SETUP.tf}</td></tr>
          <tr><td><b>Cap health gain at the GBD acute-to-stable gap</b></td><td><YesNo value={s.tfFloor} onChange={(v) => setScenario({ tfFloor: v })} /></td><td className="mut">{SETUP.cap}</td></tr>
          <tr><td><b>Survival benefit of treatment</b></td><td><YesNo value={s.mortalityScenario} onChange={(v) => setScenario({ mortalityScenario: v })} /></td><td className="mut">{SETUP.mortality}</td></tr>
          <tr><td><b>Extra survival benefit: LAIs and clozapine</b></td><td>{s.mortalityScenario ? <YesNo value={s.mortalityProductLayers} onChange={(v) => setScenario({ mortalityProductLayers: v })} /> : <span className="mut">off (needs the survival benefit of treatment)</span>}</td><td className="mut">{SETUP.mortalityLayers}</td></tr>
        </tbody>
      </table>

      <Eyebrow>{SETUP.adherenceTitle}</Eyebrow>
      <Hint>{SETUP.adherenceHint}</Hint>
      <table style={{ maxWidth: 900 }}>
        <thead><tr><th>Share of prescribed doses taken</th><th className="num">Value</th><th>Note</th></tr></thead>
        <tbody>
          {SETUP.adherenceRows.map(([k, label, note]) => (
            <tr key={k}><td><b>{label}</b></td><td className="num"><NumInput value={s.adherence[k]} pctMode onChange={(v) => setAdh(k, v)} width={70} /> <span className="mut">%</span></td><td className="mut">{note}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="btnrow"><button className="btn ghost" onClick={() => { if (confirm("Reset every setting (including product ticks and user prices) to the defaults?")) resetScenario(); }}>Reset all settings to defaults</button></div>
    </section>
  );
}
