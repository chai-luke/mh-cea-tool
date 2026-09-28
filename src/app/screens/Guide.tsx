import { useStore, type ScreenId, type SourcePage } from "../store";
import { Callout, Eyebrow, Title } from "../components";
import { ABBREVIATIONS, GUIDE_ROWS, INTERPRET, NOT_DONE } from "../content";
import { MODEL_VERSION, TOOL_BUILD, TOOL_TAG, TOOL_VERSION, WORKBOOK_SAVED } from "../version";
import { DISCLOSE_WITHHELD, PUBLIC_BUILD } from "../publicBuild";

export function Guide() {
  const { go, goSrc } = useStore();
  const jump = (to: ScreenId, src?: SourcePage) => (e: React.MouseEvent) => { e.preventDefault(); if (src) goSrc(src); else go(to); };
  const L = ({ to, children, src }: { to: ScreenId; children: React.ReactNode; src?: SourcePage }) => <a href="#" onClick={jump(to, src)}>{children}</a>;
  const N = ({ to, children }: { to: ScreenId; children: React.ReactNode }) => <a href="#" className="n" onClick={jump(to)} aria-label={`open ${to}`}>{children}</a>;
  return (
    <section>
      <Title title="Guide" sub="How to use the tool, how to read the results, and what each assumption means, in plain language." />
      <Eyebrow>How to use this tool</Eyebrow>
      <ol className="steps">
        <li><N to="setup">1</N><span><L to="setup"><b>Setup</b></L>: choose the country, the comparator (the medicine used today, or no treatment), the currency and the cost-effectiveness threshold. Optionally choose a different current-treatment medicine for each use.</span></li>
        <li><N to="products">2</N><span><L to="products"><b>Products</b></L>: tick the products to include and type any locally known price. A price typed here replaces the default everywhere in the tool. Products labelled T4 rest on a global benchmark and are the most valuable to replace. One button limits the analysis to products on the national essential medicines list.</span></li>
        <li><N to="dash">3</N><span><L to="dash"><b>CE Dashboard</b></L>: read the drug cabinet (the best-value product for each clinical use, with the product it was compared with) and the full ranking, which can be filtered to one indicated use. Green means cost-saving or good value, amber means cheaper but less effective, grey means a better product exists.</span></li>
        <li><N to="bia">4</N><span><L to="bia"><b>Budget Impact</b></L>: see what a year of medicines would cost for the people expected to be on treatment, today and at the coverage goal, against the current medicine budget. Edit the product mix, add products, and test coverage or wastage values.</span></li>
        <li><N to="scen">5</N><span><L to="scen"><b>Scenario</b></L>: find the price at which each product would become good value, and compare any two products side by side.</span></li>
        <li><N to="sens">6</N><span><L to="sens"><b>Sensitivity</b></L>: see which assumptions move the result most for any product, and try different low and high values.</span></li>
        <li className="dark"><N to="sources">≡</N><span><L to="sources"><b>Sources</b></L>: every number the model uses, with where it came from. Blue values can be changed; changes can be exported as a small file and sent back to CHAI.</span></li>
      </ol>

      <Eyebrow>How to read the results</Eyebrow>
      <table className="full"><thead><tr><th style={{ width: "22%" }}>Term</th><th>Meaning</th></tr></thead>
        <tbody>{INTERPRET.map(([k, v]) => <tr key={k}><td><b>{k}</b></td><td className="wrap">{v}</td></tr>)}</tbody></table>

      <Eyebrow>Key assumptions: what the model assumes, where it comes from, where to change it</Eyebrow>
      <table className="full"><thead><tr><th style={{ width: "16%" }}>Assumption</th><th>Plain-language meaning</th><th style={{ width: "20%" }}>Source</th><th style={{ width: "17%" }}>Where to change it</th></tr></thead>
        <tbody>{GUIDE_ROWS.map((g) => <tr key={g.topic}><td className="wrap"><b>{g.topic}</b></td><td className="wrap">{g.plain}</td><td className="mut">{g.source}</td><td className="wrap"><L to={g.where.screen as ScreenId} src={g.where.src as SourcePage | undefined}>{g.where.label}</L></td></tr>)}</tbody></table>

      <Eyebrow>What the model does not do</Eyebrow>
      <Callout>{NOT_DONE}</Callout>

      <Eyebrow>Glossary</Eyebrow>
      <table className="full" style={{ maxWidth: 820 }}><thead><tr><th>Abbreviation</th><th>Definition</th></tr></thead><tbody>{ABBREVIATIONS.map(([k, d]) => <tr key={k}><td>{k}</td><td className="wrap">{d}</td></tr>)}</tbody></table>

      <Eyebrow>About this version</Eyebrow>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: "bold", color: "var(--slate)" }}>{TOOL_VERSION} · {TOOL_TAG}: version details</summary>
        <ul style={{ fontSize: 14, margin: "6px 0 0 18px", lineHeight: 1.55 }}>
          <li>Version <b>{TOOL_VERSION}</b> ({TOOL_BUILD}), on data release {MODEL_VERSION} (saved {WORKBOOK_SAVED.replace("T", " ")}). The calculation engine is checked against a reference implementation for all four countries in both comparator modes before each release.</li>
          <li>Base case: current treatment as comparator, consumed-dose costing, hospitalisation channel on, proportional transfer factor with the GBD cap, survival benefit of treatment on, extra survival layers for injections and clozapine off (18 Sep 2026), Cobenfy adherence equal to oral adherence (14 Sep 2026). Current-treatment overrides on Setup are live; the share of patients seen by each provider in the staffing protocols is shown but not applied.</li>
          <li>Data refresh: each new data release is loaded into this tool and re-tested before publication; edits made on Sources can be exported as a data pack for the next release.</li>
          {PUBLIC_BUILD && !DISCLOSE_WITHHELD && <li>{PUBLIC_BUILD.label} of the tool, built {PUBLIC_BUILD.built}. Any value on Sources can be replaced with your own.</li>}
          {PUBLIC_BUILD && DISCLOSE_WITHHELD && <li>Public version: built {PUBLIC_BUILD.built} from the validation data release with {PUBLIC_BUILD.withheldSourceCount} price sources and {PUBLIC_BUILD.withheldCount} input values withheld pending country data clearance (rule set {PUBLIC_BUILD.preset}). Withheld prices fall through to the next public tier; Sources lists every withheld item.</li>}
          <li>Contact: Clinton Health Access Initiative (Mental Health team).</li>
        </ul>
      </details>
    </section>
  );
}
