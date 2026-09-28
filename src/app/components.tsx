import { Fragment, useState, type ReactNode } from "react";
import { useStore } from "./store";
import { fmtInput, parseInput, ucChipClass, ucMeta } from "./format";
import { DISCLOSE_WITHHELD, PUBLIC_BUILD } from "./publicBuild";

/** One-line notice on Home and CE Dashboard, only in a public build with full disclosure of withheld inputs. */
export function PublicBanner({ style }: { style?: React.CSSProperties }) {
  const { goSrc } = useStore();
  if (!PUBLIC_BUILD || !DISCLOSE_WITHHELD) return null;
  return <div className="pubbanner" role="note" style={style}>{PUBLIC_BUILD.banner} <a href="#" onClick={(e) => { e.preventDefault(); goSrc("index"); }}>See what is withheld</a></div>;
}

export function Chip({ cls, children, title }: { cls: string; children: ReactNode; title?: string }) {
  return <span className={`chip ${cls}`} title={title}>{children}</span>;
}
export function UcChip({ uc, short }: { uc: string | null | undefined; short?: boolean }) {
  const m = ucMeta(uc);
  return <span className={`chip ${ucChipClass(uc)}`}>{short ? m.short : m.label}</span>;
}
export function Eyebrow({ children }: { children: ReactNode }) { return <div className="eyebrow">{children}</div>; }
export function Hint({ children }: { children: ReactNode }) { return <div className="hint">{children}</div>; }
export function Callout({ children, amber }: { children: ReactNode; amber?: boolean }) { return <div className={`callout${amber ? " amberbox" : ""}`}>{children}</div>; }
export function Notes({ children }: { children: ReactNode }) { return <div className="notesbox">{children}</div>; }
export function Title({ title, sub }: { title: string; sub?: ReactNode }) { return <><div className="stitle">{title}</div>{sub && <div className="ssub">{sub}</div>}</>; }
export function Viz({ title, src, children, style }: { title: ReactNode; src?: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return <div className="viz" style={style}><h4>{title}</h4>{src && <div className="src">{src}</div>}{children}</div>;
}
export function Legend({ items }: { items: [string, string][] }) {
  return <div className="legend">{items.map(([c, l]) => <span key={l}><span className="dot" style={{ background: c }} />{l}</span>)}</div>;
}

/** "{Country} · vs Current treatment — change settings → Setup" line under a results title (Excel row 4). */
export function SettingsLine() {
  const { scenario, go } = useStore();
  return <div className="setline"><b>{scenario.country}</b> · vs {scenario.comparator}: <a href="#" onClick={(e) => { e.preventDefault(); go("setup"); }}>change settings → Setup</a></div>;
}

export function Sel<T extends string>({ value, options, onChange, width, labels }: { value: T; options: readonly T[]; onChange: (v: T) => void; width?: number; labels?: Partial<Record<T, string>> }) {
  return (
    <select className="sel" value={value} onChange={(e) => onChange(e.target.value as T)} style={width ? { width } : undefined}>
      {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
    </select>
  );
}
export function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <Sel value={value ? "Yes" : "No"} options={["Yes", "No"] as const} onChange={(v) => onChange(v === "Yes")} />;
}

/** Searchable dropdown: click to open, or type to filter ("halo" → haloperidol products). */
export function Combo({ value, options, onChange, placeholder, width = 250, allowBlank, blankLabel, small, groups }: { value: string | null; options: readonly string[]; onChange: (v: string | null) => void; placeholder?: string; width?: number | string; allowBlank?: boolean; blankLabel?: string; small?: boolean; /** option → group label; a header row is shown where the group changes */ groups?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState<string | null>(null);
  const shown = q ?? value ?? "";
  const needle = (q ?? "").toLowerCase();
  const filtered = options.filter((o) => o.toLowerCase().includes(needle)).slice(0, 60);
  const pick = (v: string | null) => { onChange(v); setOpen(false); setQ(null); };
  return (
    <div className="combo" style={{ width }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { setOpen(false); setQ(null); } }}>
      <input value={shown} placeholder={placeholder ?? (allowBlank ? blankLabel ?? "—" : "select…")} style={small ? { fontSize: 13, padding: "3px 22px 3px 7px" } : undefined}
        onFocus={() => { setOpen(true); setQ(""); }} onMouseDown={() => { if (!open) { setOpen(true); setQ(""); } }} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter") { if (filtered.length) pick(filtered[0]); else if (allowBlank && needle === "") pick(null); } if (e.key === "Escape") { setOpen(false); setQ(null); } }} />
      {open && (
        <div className="combo-list" tabIndex={-1}>
          {allowBlank && <div className="combo-opt blank" onMouseDown={(e) => { e.preventDefault(); pick(null); }}>{blankLabel ?? "— default —"}</div>}
          {filtered.map((o, i) => { const g = groups?.[o]; const head = g && (i === 0 || groups?.[filtered[i - 1]] !== g); return <Fragment key={o}>{head && <div className="combo-grp">{g}</div>}<div className={`combo-opt${o === value ? " on" : ""}`} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>{o}</div></Fragment>; })}
          {!filtered.length && <div className="combo-opt blank">no match</div>}
        </div>
      )}
    </div>
  );
}

/** Numeric input for scenario-level inputs (not dataset edits). Empty = null (use default). Shows #,###.00 when not editing. */
export function NumInput({ value, onChange, pctMode, placeholder, width = 100, min, max, title }: { value: number | null; onChange: (v: number | null) => void; pctMode?: boolean; placeholder?: string; width?: number; min?: number; max?: number; title?: string }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? fmtInput(value, pctMode);
  const commit = () => {
    if (text == null) return;
    let v = parseInput(text);
    if (v == null) onChange(null);
    else { if (pctMode) v /= 100; if (min != null) v = Math.max(min, v); if (max != null) v = Math.min(max, v); onChange(v); }
    setText(null);
  };
  return (
    <input className={`inputcell${value != null ? " has" : ""}`} style={{ width }} value={shown} placeholder={placeholder} title={title}
      onChange={(e) => setText(e.target.value)} onFocus={() => setText(value == null ? "" : String(+(pctMode ? value * 100 : value).toPrecision(10)))} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setText(null); }} />
  );
}

/** Incremental CE cells (Excel F:G REPT visual). Numeric ICER vs comparator: the left cell fills up to the threshold (teal when
 *  cost-effective, red when not); the right cell shows log-scaled blocks above it; the border between the cells is the threshold.
 *  Dominant / dominated / SW-quadrant / reference rows have no incremental ratio and get a labelled merged cell instead. */
export function IncrCells({ headline, lambda }: { headline: number | string | "" | null | undefined; lambda: number | null }) {
  if (typeof headline !== "number") {
    const h = String(headline ?? "");
    const cat = h === "Reference" ? { c: "#64748B", t: "Reference", d: "current treatment" }
      : h.includes("dominant") ? { c: "#15803D", t: "▲ Dominant", d: "more health, lower cost" }
      : h.includes("dominated") ? { c: "#8A94A3", t: "▼ Dominated", d: "less health, higher cost" }
      : h.includes("less costly") ? { c: "#B45309", t: "◀ SW quadrant", d: "less health, lower cost" }
      : { c: "#B9C2CE", t: "—", d: "" };
    return <td colSpan={2} className="incr" style={{ color: cat.c }} title={`${cat.t}: ${cat.d}. No incremental cost per DALY: the product is not on the trade-off diagonal.`}>{cat.t}{cat.d && <small>{cat.d}</small>}</td>;
  }
  if (lambda == null || lambda <= 0) return <><td className="barA"><span style={{ color: "#B9C2CE" }}>—</span></td><td className="barB" /></>;
  const bad = headline > lambda;
  const nA = Math.max(1, Math.round(Math.min(headline / lambda, 1) * 6));
  const nB = bad ? Math.max(1, Math.min(10, Math.round(Math.log10(headline / lambda) * 3 + 1))) : 0;
  return (
    <>
      <td className="barA"><span className={`bars${bad ? " bad" : ""}`} title={`${Math.min(100, Math.round((headline / lambda) * 100))}% of the threshold`}>{"█".repeat(nA)}</span></td>
      <td className="barB">{nB > 0 && <span className="bars bad" title={`${(headline / lambda).toFixed(1)}× the threshold (log scale)`}>{"█".repeat(nB)}</span>}</td>
    </>
  );
}
