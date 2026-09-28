// Editable cells bound to a Dataset path. Blue = editable; a teal ring + ↺ mark an edited value.
import { useState, type ReactNode } from "react";
import { useStore } from "../store";
import { editsUnder, getAt } from "../edits";
import { fmtInput, parseInput } from "../format";
import { withheldAt } from "../publicBuild";

/** Grey "withheld" chip for an input removed from the public data layer; the note is the tooltip. */
export function WithheldChip({ note }: { note: string }) {
  return <span className="chip c-wh" title={note} aria-label={`withheld: ${note}`}>withheld</span>;
}

const fmtBase = (v: unknown, pctMode?: boolean) => (v == null || v === "" ? "blank" : typeof v === "number" ? fmtInput(v, pctMode) + (pctMode ? "%" : "") : String(v));

export function NumCell({ path, pctMode, width = 90 }: { path: string; pctMode?: boolean; width?: number }) {
  const { baseDataset, dataset, edits, setEdit, clearEdit } = useStore();
  const cur = getAt(dataset, path) as number | null | undefined;
  const base = getAt(baseDataset, path) as number | null | undefined;
  const edited = path in edits;
  const withheld = withheldAt(path);
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text == null) return;
    const v = parseInput(text);
    if (v == null) { if (base == null) clearEdit(path); else setEdit(path, null); }
    else setEdit(path, pctMode ? v / 100 : v);
    setText(null);
  };
  return (
    <span className="ecell">
      {withheld && !edited && text == null && <WithheldChip note={withheld} />}
      <input className={`inputcell${edited ? " edited" : ""}${withheld && !edited ? " wh" : ""}`} style={{ width }} value={text ?? fmtInput(cur, pctMode)} placeholder={withheld ? "" : "—"}
        title={edited ? (withheld ? `Your value (withheld in the public data: ${withheld})` : `Default: ${fmtBase(base, pctMode)}`) : withheld ?? undefined}
        onFocus={() => setText(cur == null ? "" : String(+(pctMode ? cur * 100 : cur).toPrecision(10)))}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setText(null); }} />
      {edited && <button className="rst" title="Restore default" onClick={() => clearEdit(path)}>↺</button>}
    </span>
  );
}

export function TextCell({ path, width = 180 }: { path: string; width?: number }) {
  const { baseDataset, dataset, edits, setEdit, clearEdit } = useStore();
  const cur = (getAt(dataset, path) as string | null | undefined) ?? "";
  const base = getAt(baseDataset, path) as string | null | undefined;
  const edited = path in edits;
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text == null) return; const t = text.trim(); if (t === (base ?? "")) clearEdit(path); else setEdit(path, t === "" ? null : t); setText(null); };
  return (
    <span className="ecell">
      <input className={`inputcell txt${edited ? " edited" : ""}`} style={{ width }} value={text ?? cur} title={edited ? `Default: ${fmtBase(base)}` : undefined}
        onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setText(null); }} />
      {edited && <button className="rst" title="Restore default" onClick={() => clearEdit(path)}>↺</button>}
    </span>
  );
}

export function SelectCell({ path, options, allowBlank, labels, blankLabel, width }: { path: string; options: readonly string[]; allowBlank?: boolean; labels?: Record<string, string>; blankLabel?: string; width?: number }) {
  const { baseDataset, dataset, edits, setEdit, clearEdit } = useStore();
  const cur = (getAt(dataset, path) as string | null | undefined) ?? "";
  const base = getAt(baseDataset, path) as string | null | undefined;
  const edited = path in edits;
  const opts = options.includes(cur) || cur === "" ? options : [cur, ...options];
  return (
    <span className="ecell">
      <select className={`inputcell${edited ? " edited" : ""}`} value={cur} style={width ? { width } : undefined} title={edited ? `Default: ${fmtBase(base)}` : undefined}
        onChange={(e) => { const v = e.target.value; if (v === (base ?? "")) clearEdit(path); else setEdit(path, v === "" ? null : v); }}>
        {allowBlank && <option value="">{blankLabel ?? "—"}</option>}
        {opts.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
      {edited && <button className="rst" title="Restore default" onClick={() => clearEdit(path)}>↺</button>}
    </span>
  );
}

/** Page frame with provenance line and page-level reset. */
export function SrcPage({ title, sub, sheetKeys, prefixes, children }: { title: string; sub: string; sheetKeys: string[]; prefixes: string[]; children: ReactNode }) {
  const { dataset, edits, clearEdits, goSrc } = useStore();
  const mine = editsUnder(edits, prefixes);
  const metas = sheetKeys.map((k) => dataset.provenance[k]).filter(Boolean);
  return (
    <section>
      <div className="btnrow" style={{ marginTop: 0 }}><button className="btn ghost" onClick={() => goSrc("index")}>← back to Sources</button>
        {mine.length > 0 && <><span className="chip c-tea">{mine.length} edited on this page</span><button className="btn danger" onClick={() => { if (confirm(`Restore the ${mine.length} edited value(s) on this page to the defaults?`)) clearEdits(mine); }}>Reset this page</button></>}</div>
      <div className="stitle">{title}</div>
      <div className="ssub">{sub}</div>
      <div className="provmeta">Data release saved {metas[0]?.workbook_saved?.replace("T", " ")} · sheet{metas.length > 1 ? "s" : ""} {metas.map((m) => m.sheet).filter(Boolean).join(", ")}. Blue values are editable; edits persist in this browser and apply everywhere immediately.</div>
      {children}
    </section>
  );
}
