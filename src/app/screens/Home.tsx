import { useStore } from "../store";
import { Eyebrow, PublicBanner } from "../components";
import { ABOUT, HOME_SUB, HOME_TITLE, TARGET_POP } from "../content";
import { TOOL_TAG, TOOL_VERSION } from "../version";
import { IS_PUBLIC, PUBLIC_LABEL } from "../publicBuild";

export function Home() {
  const { go, edits, clearEdits, scenario } = useStore();
  const nEdits = Object.keys(edits).length;
  return (
    <section>
      <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
        <div style={{ fontSize: 24, fontWeight: "bold", color: "var(--deep)" }}>{HOME_TITLE}</div>
        <div style={{ fontSize: 14.5, color: "var(--mut)", margin: "4px 0 8px" }}>{HOME_SUB}</div>
        <span className="vchip">{TOOL_VERSION} · {TOOL_TAG}</span>&nbsp; {IS_PUBLIC && <><span className="chip c-tea">{PUBLIC_LABEL}</span>&nbsp; </>}<span className="chip c-sla">Clinton Health Access Initiative</span>
      </div>
      <PublicBanner style={{ marginTop: 14 }} />
      {nEdits > 0 && (
        <div className="banner" style={{ marginTop: 14 }}>
          <span><b>{nEdits} source value{nEdits === 1 ? "" : "s"} changed</b> from the defaults in this browser; results reflect these edits. Country currently selected: <b>{scenario.country}</b>.</span>
          <span className="btnrow" style={{ margin: 0 }}>
            <button className="btn ghost" onClick={() => go("sources")}>Review in Sources</button>
            <button className="btn danger" onClick={() => { if (confirm("Restore every source value to the default?")) clearEdits(); }}>Restore defaults</button>
          </span>
        </div>
      )}
      <Eyebrow>About this tool</Eyebrow>
      <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{ABOUT}</div>
      <Eyebrow>Target population</Eyebrow>
      <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{TARGET_POP}</div>
      <Eyebrow>Getting started</Eyebrow>
      <div className="tiles">
        <button className="tile" onClick={() => go("setup")}><b>1 · Setup</b><span>Country, comparator, threshold and currency</span></button>
        <button className="tile" onClick={() => go("products")}><b>2 · Products</b><span>Include or exclude products (or limit to the national EML) and enter locally known prices</span></button>
        <button className="tile" onClick={() => go("dash")}><b>3 · CE Dashboard</b><span>Ranked cost-effectiveness and the cost-effective drug cabinet</span></button>
        <button className="tile" onClick={() => go("bia")}><b>4 · Budget Impact</b><span>Quantities and cost of the drug cabinet under each scenario</span></button>
        <button className="tile" onClick={() => go("scen")}><b>5 · Scenario</b><span>The price at which each product becomes cost-effective</span></button>
        <button className="tile" onClick={() => go("sens")}><b>6 · Sensitivity</b><span>How results change when key assumptions vary</span></button>
      </div>
      <Eyebrow>Reference</Eyebrow>
      <div className="tiles two">
        <button className="tile dark" onClick={() => go("guide")}><b>Guide</b><span>Plain-language methods, how to read the results, and where to change each assumption</span></button>
        <button className="tile dark" onClick={() => go("sources")}><b>Sources</b><span>Every input with its provenance: editable, exportable, restorable</span></button>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--mut)", marginTop: 8 }}>Contact: Clinton Health Access Initiative</div>
    </section>
  );
}
