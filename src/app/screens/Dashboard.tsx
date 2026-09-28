import { useState } from "react";
import { USE_CATEGORIES, type UseCategory } from "../../engine";
import { useStore } from "../store";
import { Callout, Chip, Eyebrow, Hint, IncrCells, Legend, Notes, PublicBanner, Sel, SettingsLine, Title, UcChip, Viz } from "../components";
import { CePlane, StackedBars } from "../charts";
import { basisChip, comparatorsInEffect, csvCell, dalys, displayRanked, downloadText, emlMark, money, shortName, statusChip, ucColour, ucLineClass, ucMeta } from "../format";
import { DASH } from "../content";

const ALL = "All indicated uses";

export function Dashboard() {
  const { result: r, scenario: s } = useStore();
  const sym = r.currencySymbol;
  const lambda = r.threshold.value;
  const weak = r.products.filter((p) => p.included && (p.price.tier === "T3" || p.price.tier === "T4" || p.price.basisUsed === "other-default")).length;
  const nInc = r.products.filter((p) => p.included).length;
  const top8 = r.ranked.slice(0, 8);
  const [ucFilter, setUcFilter] = useState<string>(ALL);
  const ranked = displayRanked(r.ranked);
  const shown = ucFilter === ALL ? ranked : ranked.filter((p) => ucMeta(p.use).key === ucMeta(ucFilter).key);
  const inEffect = comparatorsInEffect(s, r);
  const comparators = USE_CATEGORIES.map((uc) => [uc, inEffect[uc]] as [UseCategory, string]);
  const cabinetColours: Record<string, string> = {}; for (const c of r.cabinet) if (c.product) cabinetColours[c.product] = ucColour(c.useCategory);
  const exportCsv = () => {
    const head = ["Rank", "Product", "Use", "Compared with", "ICER vs comparator ($/DALY)", "CE basis", "Total cost/yr", "Medication", "HRH initial", "HRH maintenance", "Inpatient", "SE mgmt", "Admin", "Gross DALYs", "SE decrement", "Survival DALYs", "Net DALYs", "Absolute $/DALY", "NMB"];
    const rows = shown.map((p, i) => [i + 1, p.name, p.use, p.comparator, p.headline, p.ceStatus, p.total, p.medCosted, p.hrhInitial, p.hrhMaintenance, p.inpatient, p.seCost, p.admin, p.grossDalys, p.seDecrement, p.mortalityDalys, p.netDalys, p.absolutePerDaly ?? "", p.nmb ?? ""]);
    downloadText(`mh-cea-${s.country.replace(/\s/g, "")}-ranked.csv`, [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv");
  };
  return (
    <section>
      <Title title="CE Dashboard" />
      <PublicBanner />
      <SettingsLine />
      {weak > 0 && <div style={{ marginBottom: 10 }}><Chip cls="c-amb">{DASH.priceFlag(weak, nInc)}</Chip></div>}
      {r.flags.map((f) => <Callout key={f} amber><b>{f}.</b> Cost-effectiveness labels need a threshold; rankings by cost and health gain still apply.</Callout>)}
      <Eyebrow>Cost-effective drug cabinet</Eyebrow>
      <Callout>{DASH.cabinetIntro}</Callout>
      <div className="slots">
        {r.cabinet.map((c) => {
          const p = c.product ? r.products.find((x) => x.name === c.product) : undefined;
          const b = basisChip(c.ceBasis);
          const vs = p && p.comparator && p.comparator !== c.product ? p.comparator : null;
          return (
            <div className={`slot ${ucLineClass(c.useCategory)}`} key={c.slot}>
              <div className="use" style={{ color: ucColour(c.useCategory) }}>{c.useCategory}</div>
              <div className="drug">{c.product ? shortName(c.product) : "— none —"}</div>
              <div className="vs">{vs ? <>compared with <b>{shortName(vs)}</b></> : c.product ? "the current treatment for this use" : ""}</div>
              {c.product && <Chip cls={b.cls}>{b.label}</Chip>}{" "}
              {p?.nationalEml === "Yes" && <Chip cls="c-grn">EML ✓</Chip>}{" "}
              {p && (p.price.tier === "T3" || p.price.tier === "T4") && <Chip cls="c-amb">verify local price</Chip>}
            </div>
          );
        })}
      </div>
      <div className="vizrow">
        <Viz title="Incremental cost-effectiveness plane" src={<>Each dot = one product's extra cost and extra health per patient-year <b>against the current treatment for its own indicated use</b> ({s.comparator === "No treatment" ? "no treatment in this mode" : "the reference products sit at the origin"}); hover a dot for its name, comparator and values. Below the dashed line = cost-effective at {lambda != null ? money(lambda, sym, 0) : "—"}/DALY; below the zero line = cost-saving. Cabinet products take their use-category colour.</>}>
          <CePlane r={r} cabinetColours={cabinetColours} />
          <Legend items={[["#334155", "cost-effective / current treatment"], ["#D9A407", "SW quadrant"], ["#B9C2CE", "dominated / not cost-effective"]]} />
        </Viz>
        <Viz title="Annual cost breakdown" src={<>Annual cost per patient for the top {top8.length} ranked products; hover a bar for the amounts.</>}>
          <StackedBars sym={sym} colours={["#334155", "#11D9AE", "#D9A407", "#B9C2CE"]} segmentLabels={["Medication", "Staff + inpatient", "Side-effects", "Admin"]} rows={top8.map((p) => ({ label: shortName(p.name), title: p.name, segments: [p.medCosted, p.hrhInitial + p.hrhMaintenance + p.inpatient, p.seCost, p.admin] }))} />
          <Legend items={[["#334155", "Medication"], ["#11D9AE", "HRH + Inpatient"], ["#D9A407", "Side effects"], ["#B9C2CE", "Admin"]]} />
        </Viz>
      </div>
      <div className="eyerow">
        <Eyebrow>{DASH.rankedTitle}</Eyebrow>
        <span className="btnrow" style={{ margin: 0 }}>
          <span className="mut" style={{ fontSize: 13 }}>Show</span>
          <Sel value={ucFilter} options={[ALL, ...USE_CATEGORIES]} onChange={setUcFilter} />
          <button className="btn ghost sm" onClick={exportCsv}>Download table (CSV)</button>
        </span>
      </div>
      {ucFilter !== ALL && <Hint>{shown.length} product{shown.length === 1 ? "" : "s"} for <UcChip uc={ucFilter} />, each compared with <b>{shortName(comparators.find(([uc]) => uc === ucFilter)?.[1] ?? "—")}</b>.</Hint>}
      <div className="scroll">
        <table>
          <thead><tr><th>#</th><th>Drug</th><th className="num">Incremental {sym}/DALY vs comparator</th><th colSpan={2} style={{ textAlign: "center" }}>Incremental CE</th><th>CE basis</th><th className="num">Absolute {sym}/DALY (vs no care)</th><th className="num">Medicine ({sym}/yr)</th><th className="num">Total ({sym}/yr)</th><th className="num">Net DALYs</th><th>Nat. EML</th><th>Use</th></tr></thead>
          <tbody>
            {shown.map((p, i) => {
              const st = statusChip(p.ceStatus);
              const numeric = typeof p.headline === "number";
              return (
                <tr key={p.intId} className={p.ceStatus === "Dominated" ? "dim" : ""}>
                  <td className="num">{i + 1}</td><td className="nw" title={p.comparator && p.comparator !== p.name ? `compared with ${p.comparator}` : undefined}>{p.name}</td>
                  <td className="num" style={numeric ? undefined : { color: "#8A94A3" }}>{numeric ? money(p.headline as number, sym, 0) : p.headline === "Reference" ? "Reference" : "n/a"}</td>
                  <IncrCells headline={p.headline} lambda={lambda} />
                  <td><Chip cls={st.cls}>{st.label}</Chip></td>
                  <td className="num">{p.absolutePerDaly != null ? money(p.absolutePerDaly, sym, 0) : "—"}</td>
                  <td className="num" title="Medicine cost per patient-year on the selected costing basis (consumed doses by default)">{money(p.medCosted, sym, 2)}</td><td className="num">{money(p.total, sym, 2)}</td><td className="num">{dalys(p.netDalys)}</td>
                  <td style={{ textAlign: "center", color: "#15803D", fontWeight: "bold" }}>{emlMark(p.nationalEml)}</td>
                  <td className="chipcell"><span title={p.use ?? ""}><UcChip uc={p.use} short /></span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Notes><p><b>How to read this table</b></p>{DASH.notes.map(([k, v]) => <p key={k}><b>{k}</b>: {v}</p>)}</Notes>
    </section>
  );
}
