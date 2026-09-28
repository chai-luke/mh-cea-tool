import { useMemo } from "react";
import { tornado } from "../../engine";
import { useStore } from "../store";
import { Chip, Combo, Eyebrow, Hint, Notes, NumInput, SettingsLine, Title, UcChip, Viz } from "../components";
import { Tornado } from "../charts";
import { groupLabels, money, namesInDisplayOrder, num, pct, shortName } from "../format";
import { SENS } from "../content";

export function Sensitivity() {
  const { result: r, scenario: s, setScenario, dataset } = useStore();
  const sym = r.currencySymbol;
  const lambda = r.threshold.value;
  const subject = r.products.some((p) => p.name === s.sensitivitySubject) ? s.sensitivitySubject : r.products[0].name;
  const S = r.products.find((p) => p.name === subject)!;
  const compOverride = s.sensitivityComparator && s.sensitivityComparator !== subject ? s.sensitivityComparator : null;
  const t = useMemo(() => tornado(r, dataset, subject, compOverride), [r, dataset, subject, compOverride]);
  const engineComp = S.comparator || "No treatment";
  const compOptions = ["No treatment", ...namesInDisplayOrder(r.products).filter((n) => n !== subject)];
  const groups = groupLabels(r.products);
  const baseNum = typeof t?.baseIcer === "number" ? (t!.baseIcer as number) : null;
  // hide parameter rows whose switch is off: the treated-vs-untreated HR needs the survival channel; the LAI OR and clozapine HR need the product layers too
  const visibleRows = (t?.rows ?? []).filter((x) => !x.parameter.startsWith("Real-world")
    && (s.mortalityScenario || !x.parameter.startsWith("Survival HR — any"))
    && ((s.mortalityScenario && s.mortalityProductLayers) || (!x.parameter.startsWith("Survival OR") && !x.parameter.startsWith("Survival HR — clozapine"))));
  const bars = visibleRows.filter((x) => typeof x.icerAtLow === "number" && typeof x.icerAtHigh === "number" && baseNum != null && (x.swing ?? 0) > 0)
    .sort((a, b) => (b.swing ?? 0) - (a.swing ?? 0))
    .map((x) => ({ label: x.parameter.length > 42 ? x.parameter.slice(0, 40) + "…" : x.parameter, low: x.icerAtLow as number, high: x.icerAtHigh as number, lowLabel: money(x.icerAtLow as number, sym, 0), highLabel: money(x.icerAtHigh as number, sym, 0) }));
  const verdict = baseNum == null || lambda == null ? null : baseNum <= lambda / 3 ? "Very cost-effective" : baseNum <= lambda ? "Cost-effective" : "Not cost-effective";
  const setBound = (label: string, k: "low" | "high", v: number | null) => setScenario({ sensitivityBounds: { ...s.sensitivityBounds, [label]: { ...{ low: null, high: null }, ...(s.sensitivityBounds[label] ?? {}), [k]: v } } });
  const fmtI = (v: number | string) => (typeof v === "number" ? money(v, sym, 0) : v);
  return (
    <section>
      <Title title={SENS.title} sub={SENS.sub} />
      <SettingsLine />
      <Eyebrow>1. Product selection</Eyebrow>
      <table className="settings" style={{ maxWidth: 860 }}><tbody>
        <tr><td><b>Selected drug</b></td><td><Combo value={subject} options={namesInDisplayOrder(r.products)} onChange={(v) => v && setScenario({ sensitivitySubject: v })} width={300} groups={groups} /></td><td className="mut">Type to search or pick from the list</td></tr>
        <tr><td><b>Use category</b></td><td><UcChip uc={S.use} /></td><td /></tr>
        <tr><td><b>Comparator drug</b></td><td><Combo value={compOverride ?? engineComp} options={compOptions} onChange={(v) => setScenario({ sensitivityComparator: v && v !== engineComp ? v : null })} width={300} groups={groups} /></td><td className="mut">Default = the comparator used on the dashboard ({s.comparator === "Current treatment" ? "the country's current treatment for this use" : "no treatment"}). Pick any other product to compare against it on this page only.</td></tr>
        <tr><td><b>Live $/DALY</b></td><td><b>{baseNum != null ? money(baseNum, sym, 0) + " / DALY" : String(t?.baseIcer ?? "—")}</b></td><td className="mut">{verdict ? `${verdict} at ${money(lambda, sym, 0)}` : "no numeric ICER: see below"}</td></tr>
        <tr><td><b>Live CE basis</b></td><td>{compOverride ? <span className="mut">vs {shortName(compOverride)}</span> : S.ceBasis || "—"}</td><td className="mut">CE threshold {lambda != null ? money(lambda, sym, 2) : r.threshold.flag}</td></tr>
      </tbody></table>

      <Viz title="Tornado: change in $/DALY from the base case" src="Teal = result at the low bound, slate = at the high bound. Rows whose result turns into a category (dominated, dominant, SW) at one bound are listed in the table but not drawn." style={{ marginTop: 12 }}>
        {baseNum != null && bars.length ? <Tornado bars={bars} base={baseNum} sym={sym} /> : <div className="nodata"><b>{SENS.noTornadoTitle}</b><span>{SENS.noTornadoBody}</span></div>}
      </Viz>

      <Eyebrow>2. Parameters (Low / High are editable inputs) and results</Eyebrow>
      <Hint>Type a low or high bound (blue) to re-run the tornado; blank restores the default bound. Scenario rows re-run the whole engine with the alternative method. Value change = the difference between the ICER at the high and low bounds, and as % of the base case.</Hint>
      <div className="scroll">
        <table className="tight">
          <thead><tr><th>Parameter</th><th>Scope</th><th className="num">Base (selected, live)</th><th className="num">Low</th><th className="num">High</th><th className="num">ICER at Low</th><th className="num">ICER at High</th><th className="num">Value change</th><th className="num">% of base</th></tr></thead>
          <tbody>{visibleRows.map((x) => {
            const editable = x.scope !== "Scenario" && x.low != null;
            return (
              <tr key={x.parameter}><td className="wrap">{x.parameter}</td><td><Chip cls={x.scope === "Global" ? "c-sla" : x.scope === "Drug" ? "c-tea" : "c-gry"}>{x.scope}</Chip></td>
                <td className="num">{x.base != null ? num(x.base, x.base < 1 ? 3 : 2) : "—"}</td>
                <td className="num">{editable ? <NumInput value={s.sensitivityBounds[x.parameter]?.low ?? null} placeholder={num(x.low, (x.low ?? 1) < 1 ? 3 : 2)} onChange={(v) => setBound(x.parameter, "low", v)} width={76} /> : x.low != null ? num(x.low, x.low < 1 ? 3 : 2) : "—"}</td>
                <td className="num">{editable ? <NumInput value={s.sensitivityBounds[x.parameter]?.high ?? null} placeholder={num(x.high, (x.high ?? 1) < 1 ? 3 : 2)} onChange={(v) => setBound(x.parameter, "high", v)} width={76} /> : x.high != null ? num(x.high, x.high < 1 ? 3 : 2) : "—"}</td>
                <td className="num">{fmtI(x.icerAtLow)}</td><td className="num">{fmtI(x.icerAtHigh)}</td>
                <td className="num">{x.swing != null ? money(x.swing, sym, 0) : "n/a"}</td><td className="num">{x.swing != null && baseNum ? pct(x.swing / baseNum, 0) : "n/a"}</td></tr>
            );
          })}</tbody>
        </table>
      </div>
      <Notes>{SENS.fixed} If the selected product is cheaper-and-less-effective, dominant, or the reference itself, its result is a category rather than a number and the chart shows no bars. The parameter block uses the two-arm calculation (gross effect = transfer factor × SMD × adherence, minus the side-effect decrement, plus the survival term for the switches that are on; no GBD cap); the scenario rows re-run the full engine.</Notes>
    </section>
  );
}
