import { Fragment } from "react";
import { useStore } from "../store";
import { Chip, Eyebrow, Hint, NumInput, Title, UcChip } from "../components";
import { comparatorsInEffect, emlMark, price, sortDisplay, tierClass, useLabelOf } from "../format";
import { ABBREVIATIONS, BASIS_NOTES, PRODUCTS_SUB } from "../content";

const cap = (t: string | null | undefined) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
const TIER_LABEL: Record<string, string> = { T1: "In-country procurement", T2: "India export price", T3: "Focus-country proxy", T4: "Global benchmark" };
const tierOf = (p: { price: { tier: string | null; basisUsed: string } }) => p.price.tier ?? (p.price.basisUsed === "other-default" ? "T4" : "—");

export function Products() {
  const { scenario: s, setScenario, result, dataset } = useStore();
  const sym = result.currencySymbol;
  const rows = sortDisplay(result.products);
  const comps = comparatorsInEffect(s, result);
  const nIn = rows.filter((p) => p.included).length;
  const nEml = rows.filter((p) => p.nationalEml === "Yes").length;
  const emlOnly = rows.length > 0 && rows.every((p) => p.included === (p.nationalEml === "Yes"));
  const allIn = rows.every((p) => p.included);
  const setAll = (pick: (p: (typeof rows)[number]) => boolean) => { const inc: Record<string, boolean> = { ...s.included }; for (const p of rows) inc[p.intId] = pick(p); setScenario({ included: inc }); };
  // distinct source strings per tier for the selected country (shown in the legend, not in the table)
  const srcByTier: Record<string, string[]> = {};
  for (const p of rows) { const t = tierOf(p); const src = (p.price.source ?? "").trim(); if (!src) continue; (srcByTier[t] ??= []); if (!srcByTier[t].includes(src)) srcByTier[t].push(src); }
  return (
    <section>
      <Title title="Products" sub={PRODUCTS_SUB} />
      <Eyebrow>Select products and enter prices for analysis</Eyebrow>
      <div className="eyerow" style={{ marginBottom: 6 }}>
        <Hint>{nIn} of {rows.length} products included for {s.country}; {nEml} are on the national essential medicines list. A user unit price (USD) overrides the default everywhere; leave blank to use the default. Products are grouped by indicated use, with the current treatment for each use named in the group header.</Hint>
        <span className="btnrow" style={{ margin: 0 }}>
          <span className="mut" style={{ fontSize: 13 }}>Include:</span>
          <button className={`btn sm${allIn ? "" : " ghost"}`} disabled={allIn} onClick={() => setAll(() => true)} title="Tick every product">All products</button>
          <button className={`btn sm${emlOnly ? "" : " ghost"}`} disabled={emlOnly} onClick={() => setAll((p) => p.nationalEml === "Yes")} title={`Tick only the ${nEml} products on the ${s.country} essential medicines list and untick the rest`}>National EML only</button>
        </span>
      </div>
      <div className="scroll">
        <table className="compact">
          <thead><tr><th>Include?</th><th>Product</th><th>Formulation · schedule</th><th>Class</th><th title="On the national essential medicines list">EML</th><th className="num">Default cost ({sym})</th><th className="num">User price (USD)</th><th>Cost unit</th><th>Price reliability</th></tr></thead>
          <tbody>
            {rows.map((p, idx) => {
              const prod = dataset.products.find((x) => x.intId === p.intId);
              const freq = (dataset.medCosts.find((x) => x.intId === p.intId)?.frequency ?? "").toLowerCase().replace("acute (prn)", "as needed");
              const tier = tierOf(p);
              const label = useLabelOf(p);
              const newGroup = idx === 0 || useLabelOf(rows[idx - 1]) !== label;
              const isRef = s.comparator === "Current treatment" && p.comparator === p.name;
              return (
                <Fragment key={p.intId}>
                  {newGroup && <tr className="grp"><td colSpan={9}><UcChip uc={label} /><span className="mut">compared with <b>{comps[label] ?? "—"}</b></span></td></tr>}
                  <tr className={p.included ? "" : "dim"}>
                    <td style={{ textAlign: "center" }}><input type="checkbox" className="check" checked={p.included} onChange={(e) => setScenario({ included: { ...s.included, [p.intId]: e.target.checked } })} aria-label={`include ${p.name}`} title={p.included ? "Included; untick to exclude" : "Excluded; tick to include"} /></td>
                    <td className="nw"><b>{p.name}</b>{isRef && <> <Chip cls="c-sla">current treatment</Chip></>}</td>
                    <td className="mut">{cap(p.formulation)}{freq ? ` · ${freq}` : ""}</td>
                    <td className="chipcell"><Chip cls="c-sla">{p.category}</Chip></td>
                    <td style={{ textAlign: "center", color: "#15803D", fontWeight: "bold" }}>{emlMark(p.nationalEml)}</td>
                    <td className="num">{price(p.price.defaultUnitPrice, sym)}</td>
                    <td className="num"><NumInput value={s.userUnitPrice[p.intId] ?? null} onChange={(v) => setScenario({ userUnitPrice: { ...s.userUnitPrice, [p.intId]: v && v > 0 ? v : null } })} width={78} placeholder="enter price" /></td>
                    <td className="mut nw">{(prod?.costUnit ?? "").replace(/^per /, "")}</td>
                    <td className="chipcell" title={p.price.source ?? ""}><Chip cls={tierClass(tier)}>{tier}</Chip> <span className="mut">{TIER_LABEL[tier] ?? "Global benchmark"}</span></td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="split" style={{ marginTop: 10 }}>
        <div><Eyebrow>Price reliability (T1 to T4)</Eyebrow>
          <table className="full"><thead><tr><th>Tier</th><th>Meaning</th><th>Sources used for {s.country}</th></tr></thead><tbody>{BASIS_NOTES.map(([t2, c, m]) => <tr key={t2}><td className="chipcell"><Chip cls={c}>{t2}</Chip></td><td>{m}</td><td className="mut">{(srcByTier[t2] ?? []).join("; ") || "—"}</td></tr>)}</tbody></table></div>
        <div><Eyebrow>Key abbreviations and terms</Eyebrow>
          <table className="full"><thead><tr><th>Abbreviation</th><th>Definition</th></tr></thead><tbody>{ABBREVIATIONS.map(([k, d]) => <tr key={k}><td className="nw">{k}</td><td>{d}</td></tr>)}</tbody></table></div>
      </div>
    </section>
  );
}
