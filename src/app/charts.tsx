// Hand-rolled SVG charts (no chart library; single-file friendly) with a shared hover tooltip.
import { useRef, useState, type ReactNode } from "react";
import type { AnalysisResult, ProductResult } from "../engine";
import { fmtNum, money, price } from "./format";

const C = { slate: "#334155", teal: "#11D9AE", tealdk: "#0B9C7D", gold: "#D9A407", pale: "#B9C2CE", grid: "#EDF1F5", axis: "#94A3B8", mut: "#64748B", red: "#B91C1C" };

/** Tooltip state for one chart: call show(e, content) from mouse handlers, hide() on leave; render {tip} inside the .vizwrap. */
function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<{ x: number; y: number; c: ReactNode } | null>(null);
  const show = (e: React.MouseEvent, c: ReactNode) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    setT({ x: Math.min(e.clientX - r.left + 14, Math.max(0, r.width - 290)), y: e.clientY - r.top + 14, c });
  };
  const hide = () => setT(null);
  const tip = t ? <div className="tip" style={{ left: t.x, top: t.y }}>{t.c}</div> : null;
  return { ref, show, hide, tip };
}

function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) for (const m of [1, 2, 5]) { const v = m * 10 ** k; if (v >= lo && v <= hi) out.push(v); }
  return out.length > 7 ? out.filter((_, i) => i % 2 === 0) : out;
}
const fmtTick = (v: number) => (v >= 1000 ? `${fmtNum(v / 1000, v % 1000 ? 1 : 0)}k` : v >= 1 ? fmtNum(v, 0) : fmtNum(v, v < 0.01 ? 3 : 2));
const statusText = (p: ProductResult) => p.ceStatus === "Current tx" ? "Current treatment" : p.ceStatus === "SW quadrant" ? "SW quadrant: cheaper, less effective" : p.ceStatus || "excluded";

/** Incremental CE plane (17 Sep 2026): each product vs its OWN use-category comparator (or No treatment in that mode).
 *  x = Δ DALYs averted, y = Δ cost per patient-year (symmetric-log so ±$10 and ±$3,000 both read); comparators sit at the origin;
 *  the dashed line is y = λ·x — below it = cost-effective at the live threshold. Replaces the absolute total-cost plane, on which a
 *  category reference such as clozapine sat "above the line" only because it costs more than risperidone. */
export function CePlane({ r, cabinetColours }: { r: AnalysisResult; cabinetColours?: Record<string, string> }) {
  const { ref, show, hide, tip } = useTip();
  const refs = r.products.filter((p) => p.included && p.comparator === p.name);
  const pts = r.products.filter((p) => p.included && p.comparator !== p.name && p.deltaDalys != null && p.deltaCost != null);
  if (!pts.length) return <div className="hint">No included products to compare.</div>;
  const W = 480, H = 270, L = 56, B = 36, T = 14, R = 14;
  const lambda = r.threshold.value;
  const sym = r.currencySymbol;
  const dx = pts.map((p) => p.deltaDalys as number), dy = pts.map((p) => p.deltaCost as number);
  const xmin = Math.min(0, ...dx) * 1.1 - 0.002, xmax = Math.max(0, ...dx) * 1.1 + 0.002;
  const S = 10; // symlog scale: linear within ±$10, log beyond
  const sl = (v: number) => Math.sign(v) * Math.log10(1 + Math.abs(v) / S);
  const ymin = Math.min(0, ...dy, lambda != null ? lambda * xmin : 0), ymax = Math.max(0, ...dy, lambda != null ? lambda * xmax : 0);
  const [symin, symax] = [sl(ymin) - 0.15, sl(ymax) + 0.15];
  const xs = (x: number) => L + ((x - xmin) / (xmax - xmin)) * (W - L - R);
  const ys = (y: number) => H - B - ((sl(y) - symin) / (symax - symin)) * (H - B - T);
  let path = "";
  if (lambda != null) {
    const steps = 80;
    for (let i = 0; i <= steps; i++) { const x = xmin + ((xmax - xmin) * i) / steps; const y = lambda * x; if (y >= ymin && y <= ymax) path += (path ? "L" : "M") + xs(x).toFixed(1) + " " + ys(y).toFixed(1) + " "; }
  }
  const cabinet = new Set(r.cabinet.map((c) => c.product).filter(Boolean) as string[]);
  const colour = (p: ProductResult) => cabinet.has(p.name) ? (cabinetColours?.[p.name] ?? C.teal) : p.ceStatus === "SW quadrant" ? C.gold : p.ceBasis === "Dominant (cost-saving)" || p.ceStatus === "Very CE" || p.ceStatus === "CE" ? C.slate : C.pale;
  const yTicks = [-3000, -1000, -300, -100, -30, -10, 0, 10, 30, 100, 300, 1000, 3000].filter((v) => v >= ymin && v <= ymax);
  const xt = Array.from({ length: 5 }, (_, i) => xmin + ((xmax - xmin) * i) / 4);
  const compLabel = r.scenario.comparator === "No treatment" ? "No treatment" : `current treatment for its use (${refs.map((p) => p.name.replace(/ \(oral\)| \(LAI\)| \(IM, short-acting\)/g, "")).join(", ")})`;
  const tipFor = (p: ProductResult) => <><b>{p.name}</b><br />vs {p.comparator}<br />{(p.deltaCost as number) >= 0 ? "+" : "−"}{money(Math.abs(p.deltaCost as number), sym)} per patient-year · {(p.deltaDalys as number) >= 0 ? "+" : "−"}{fmtNum(Math.abs(p.deltaDalys as number), 4)} DALYs<br />{p.ceBasis === "Incremental" && typeof p.icerVsComparator === "number" ? `${money(p.icerVsComparator, sym, 0)}/DALY: ${p.ceStatus}` : statusText(p)}{cabinet.has(p.name) ? <><br />in the drug cabinet</> : null}</>;
  return (
    <div className="vizwrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: Math.round(W * 1.15) }} role="img" aria-label="Incremental cost-effectiveness plane" onMouseLeave={hide}>
        {yTicks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={ys(v)} y2={ys(v)} stroke={v === 0 ? C.axis : C.grid} /><text x={L - 5} y={ys(v) + 3} fontSize="10" fill={C.axis} textAnchor="end">{v < 0 ? "−" : ""}{sym}{fmtTick(Math.abs(v))}</text></g>)}
        {xt.map((v) => <text key={v} x={xs(v)} y={H - 16} fontSize="10" fill={C.axis} textAnchor="middle">{(v > 0 ? "+" : "") + fmtNum(v, 3)}</text>)}
        <line x1={xs(0)} x2={xs(0)} y1={T} y2={H - B} stroke={C.axis} strokeDasharray="2 3" />
        <text x={(L + W - R) / 2} y={H - 3} fontSize="10.5" fill={C.mut} textAnchor="middle">Δ DALYs averted vs comparator, per patient-year (+ = more health)</text>
        <text transform={`translate(11 ${(T + H - B) / 2}) rotate(-90)`} fontSize="10.5" fill={C.mut} textAnchor="middle">Δ cost vs comparator ({sym}/patient-year)</text>
        {path && <path d={path} stroke="#0E7490" strokeWidth="1.4" strokeDasharray="5 4" fill="none" />}
        {path && lambda != null && <text x={W - R} y={T + 9} fontSize="10" fill="#0E7490" textAnchor="end">cost-effective below the line · {money(lambda, sym, 0)}/DALY</text>}
        <g className="hover-target" onMouseMove={(e) => show(e, <><b>Comparator (origin)</b><br />{compLabel}</>)}>
          <circle cx={xs(0)} cy={ys(0)} r={10} fill="transparent" />
          <circle cx={xs(0)} cy={ys(0)} r={5} fill="#fff" stroke={C.slate} strokeWidth="1.6" />
        </g>
        {pts.map((p) => (
          <g key={p.intId} className="hover-target" onMouseMove={(e) => show(e, tipFor(p))}>
            <circle cx={xs(p.deltaDalys as number)} cy={ys(p.deltaCost as number)} r={10} fill="transparent" />
            <circle cx={xs(p.deltaDalys as number)} cy={ys(p.deltaCost as number)} r={cabinet.has(p.name) ? 5.5 : 3.8} fill={colour(p)} stroke="#fff" strokeWidth="1" />
          </g>
        ))}
      </svg>
      {tip}
    </div>
  );
}

export interface StackRow { label: string; segments: number[]; title?: string }
export function StackedBars({ rows, colours, sym = "$", labelWidth = 116, refLine, barHeight, segmentLabels }: { rows: StackRow[]; colours: string[]; sym?: string; labelWidth?: number; refLine?: { value: number; label: string } | null; barHeight?: number; segmentLabels?: string[] }) {
  const { ref, show, hide, tip } = useTip();
  if (!rows.length) return <div className="hint">Nothing to show.</div>;
  const W = 480, BH = barHeight ?? (rows.length > 4 ? 20 : 26), G = rows.length > 4 ? 8 : 14, L = labelWidth, Rm = 84;
  const totals = rows.map((r) => r.segments.reduce((a, b) => a + b, 0));
  const max = Math.max(...totals, refLine?.value ?? 0) * 1.02 || 1;
  const H = (BH + G) * rows.length + (refLine ? 22 : 8);
  const sx = (v: number) => (v / max) * (W - L - Rm);
  const rowTip = (r: StackRow, i: number, k?: number) => (
    <><b>{r.title ?? r.label}</b><br />
      {r.segments.map((v, j) => v > 0 || j === k ? <span key={j} style={{ fontWeight: j === k ? "bold" : "normal" }}>{segmentLabels?.[j] ?? `Series ${j + 1}`}: {money(v, sym)}<br /></span> : null)}
      Total: {money(totals[i], sym)}</>
  );
  return (
    <div className="vizwrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: Math.round(W * 1.15) }} role="img" onMouseLeave={hide}>
        {rows.map((r, i) => {
          let x = L; const y = i * (BH + G) + 4;
          return (
            <g key={r.label} className="hover-target">
              <text x={L - 6} y={y + BH / 2 + 4} fontSize="11.5" fill={C.slate} textAnchor="end" onMouseMove={(e) => show(e, rowTip(r, i))}>{r.label}</text>
              {r.segments.map((v, k) => { const w = sx(v); const rect = <rect key={k} x={x} y={y} width={Math.max(0, w)} height={BH} fill={colours[k % colours.length]} onMouseMove={(e) => show(e, rowTip(r, i, k))} />; x += w; return rect; })}
              <text x={x + 5} y={y + BH / 2 + 4} fontSize="11" fontWeight="bold" fill={C.slate}>{money(totals[i], sym, 0)}</text>
            </g>
          );
        })}
        {refLine && <><line x1={L + sx(refLine.value)} x2={L + sx(refLine.value)} y1={2} y2={(BH + G) * rows.length + 2} stroke={C.red} strokeWidth="1.4" strokeDasharray="5 4" /><text x={Math.min(L + sx(refLine.value) + 4, W - 170)} y={(BH + G) * rows.length + 14} fontSize="10.5" fill={C.red}>{refLine.label}</text></>}
      </svg>
      {tip}
    </div>
  );
}

export interface DumbbellRow { label: string; from: number; to: number; tag: string; up: boolean }
/** Default price (○) vs cost-effective price (●) on a log axis, with data labels at both ends and a hover tooltip per row. */
export function Dumbbell({ rows, sym = "$" }: { rows: DumbbellRow[]; sym?: string }) {
  const { ref, show, hide, tip } = useTip();
  if (!rows.length) return <div className="hint">No products with a workable price at these settings.</div>;
  const W = 800, BH = 17, G = 10, L = 200, Rm = 80;
  const vals = rows.flatMap((r) => [r.from, r.to]).filter((v) => v > 0);
  const lo = Math.log10(Math.min(...vals) / 2.5), hi = Math.log10(Math.max(...vals) * 2.5);
  const xs = (v: number) => L + ((Math.log10(Math.max(v, 1e-9)) - lo) / (hi - lo)) * (W - L - Rm);
  const H = (BH + G) * rows.length + 32;
  const rowTip = (r: DumbbellRow) => <><b>{r.label}</b><br />Default price {price(r.from, sym)} per unit<br />Cost-effective price {price(r.to, sym)} per unit<br />{r.up ? `Headroom: the price could rise ${r.tag.replace("×", "")}× and stay cost-effective` : `Needs a cut of ${r.tag.replace("−", "")} to become cost-effective`}</>;
  return (
    <div className="vizwrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: Math.round(W * 1.15) }} role="img" onMouseLeave={hide}>
        {logTicks(10 ** lo, 10 ** hi).map((v) => <g key={v}><line x1={xs(v)} x2={xs(v)} y1={2} y2={(BH + G) * rows.length + 4} stroke={C.grid} /><text x={xs(v)} y={(BH + G) * rows.length + 16} fontSize="10" fill={C.axis} textAnchor="middle">{sym}{fmtTick(v)}</text></g>)}
        <text x={(L + W - Rm) / 2} y={H - 2} fontSize="10.5" fill={C.mut} textAnchor="middle">price per unit, log scale · ○ default price · ● cost-effective price</text>
        {rows.map((r, i) => {
          const y = i * (BH + G) + 4 + BH / 2; const c = r.up ? C.tealdk : C.gold;
          const x1 = xs(r.from), x2 = xs(r.to);
          const leftX = Math.min(x1, x2), rightX = Math.max(x1, x2);
          const leftV = x1 <= x2 ? r.from : r.to, rightV = x1 <= x2 ? r.to : r.from;
          return (
            <g key={r.label} className="hover-target" onMouseMove={(e) => show(e, rowTip(r))}>
              <rect x={0} y={y - BH / 2 - 2} width={W} height={BH + 4} fill="transparent" />
              <text x={L - 6} y={y + 3.5} fontSize="11" fill={C.slate} textAnchor="end">{r.label}</text>
              <line x1={x1} y1={y} x2={x2} y2={y} stroke={c} strokeWidth="2.5" />
              <circle cx={x1} cy={y} r={4.5} fill="#fff" stroke={C.mut} strokeWidth="1.6" />
              <circle cx={x2} cy={y} r={4.5} fill={c} />
              <text x={leftX - 7} y={y + 3.5} fontSize="9.5" fill={C.mut} textAnchor="end">{price(leftV, sym)}</text>
              <text x={rightX + 7} y={y + 3.5} fontSize="9.5" fill={C.mut}>{price(rightV, sym)}</text>
              <text x={W - Rm + 10} y={y + 3.5} fontSize="11" fontWeight="bold" fill={r.up ? "#15803D" : "#92600A"}>{r.tag}</text>
            </g>
          );
        })}
      </svg>
      {tip}
    </div>
  );
}

export function TwoArmBars({ a, b, sym = "$" }: { a: { name: string; total: number; parts: [string, number][] }; b: { name: string; total: number; parts: [string, number][] }; sym?: string }) {
  const { ref, show, hide, tip } = useTip();
  const W = 460, BH = 16, G = 5, L = 96;
  const max = Math.max(...a.parts.map((p) => p[1]), ...b.parts.map((p) => p[1]), 1e-9);
  const n = a.parts.length + b.parts.length;
  let y = 4;
  const block = (arm: typeof a, fill: string, colour: string) => {
    const els = [<text key={"h" + arm.name} x={L} y={y + 9} fontSize="11.5" fontWeight="bold" fill={colour}>{arm.name.replace(" (IM, short-acting)", " (IM)")}: total {money(arm.total, sym)}/yr</text>];
    y += 15;
    for (const [label, v] of arm.parts) {
      const w = Math.max(1.5, (v / max) * (W - L - 70));
      els.push(<g key={arm.name + label} className="hover-target" onMouseMove={(e) => show(e, <><b>{arm.name}</b><br />{label}: {money(v, sym)} per patient-year<br />{fmtNum((v / arm.total) * 100, 0)}% of the total</>)}><text x={L - 6} y={y + BH - 4} fontSize="10.5" fill={C.mut} textAnchor="end">{label}</text><rect x={L} y={y} width={w} height={BH} fill={fill} /><text x={L + w + 4} y={y + BH - 4} fontSize="10" fill={C.mut}>{money(v, sym, v < 10 ? 2 : 0)}</text></g>);
      y += BH + G;
    }
    y += 8;
    return els;
  };
  const A = block(a, C.slate, C.slate); const Bb = block(b, C.teal, C.tealdk);
  return <div className="vizwrap" ref={ref}><svg viewBox={`0 0 ${W} ${(BH + G) * n + 54}`} style={{ width: "100%", maxWidth: Math.round(W * 1.15) }} role="img" onMouseLeave={hide}>{A}{Bb}</svg>{tip}</div>;
}

export interface TornadoBar { label: string; low: number; high: number; lowLabel: string; highLabel: string }
/** Tornado with a fixed label gutter and value labels outside the bars so nothing overlaps; hover for the exact values. */
export function Tornado({ bars, base, sym = "$" }: { bars: TornadoBar[]; base: number; sym?: string }) {
  const { ref, show, hide, tip } = useTip();
  if (!bars.length) return <div className="nodata"><b>Tornado plot not displayed</b><span>No parameter changes the result under the current settings.</span></div>;
  const W = 720, BH = 18, G = 8, L = 262, VL = 62, Rm = 10;
  const all = bars.flatMap((b) => [b.low, b.high, base]);
  const lo = Math.min(...all), hi = Math.max(...all); const span = hi - lo || 1;
  const x0 = L + VL, x1 = W - Rm - VL;
  const xs = (v: number) => x0 + ((v - lo) / span) * (x1 - x0);
  const H = (BH + G) * bars.length + 30;
  const barTip = (b: TornadoBar) => <><b>{b.label}</b><br />At the low bound: {money(b.low, sym, 0)}/DALY<br />At the high bound: {money(b.high, sym, 0)}/DALY<br />Base case: {money(base, sym, 0)}/DALY</>;
  return (
    <div className="vizwrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: Math.round(W * 1.15) }} role="img" onMouseLeave={hide}>
        {bars.map((b, i) => {
          const y = i * (BH + G) + 4;
          const left = Math.min(b.low, b.high, base), right = Math.max(b.low, b.high, base);
          const leftLabel = b.low <= b.high ? b.lowLabel : b.highLabel, rightLabel = b.low <= b.high ? b.highLabel : b.lowLabel;
          return (
            <g key={b.label} className="hover-target" onMouseMove={(e) => show(e, barTip(b))}>
              <rect x={0} y={y - 2} width={W} height={BH + 4} fill="transparent" />
              <text x={L - 8} y={y + BH - 5} fontSize="11" fill={C.slate} textAnchor="end">{b.label}</text>
              <rect x={Math.min(xs(base), xs(b.low))} y={y} width={Math.abs(xs(b.low) - xs(base))} height={BH} fill={C.teal} />
              <rect x={Math.min(xs(base), xs(b.high))} y={y} width={Math.abs(xs(b.high) - xs(base))} height={BH} fill={C.slate} />
              <text x={xs(left) - 4} y={y + BH - 5} fontSize="9.5" fill={C.mut} textAnchor="end">{leftLabel}</text>
              <text x={xs(right) + 4} y={y + BH - 5} fontSize="9.5" fill={C.mut}>{rightLabel}</text>
            </g>
          );
        })}
        <line x1={xs(base)} y1={0} x2={xs(base)} y2={(BH + G) * bars.length + 2} stroke={C.mut} strokeWidth="1.2" />
        <text x={xs(base)} y={(BH + G) * bars.length + 20} fontSize="11" fill={C.mut} textAnchor="middle">base case {money(base, sym, 0)}/DALY</text>
      </svg>
      {tip}
    </div>
  );
}
