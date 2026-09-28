// Public data layer (data/public, written by tools/build_public.py from data/v32 + data/public/redactions.json).
// Runs in the private repo (where it also cross-checks against data/v32) and in the public repo (data/public only).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyze, budgetImpact, COUNTRIES, datasetFromJson, defaultScenario, ejpTable, tornado, type Dataset, type RawData } from "../src/engine";
import { getAt } from "../src/app/edits";

const FILES = ["interventions", "products", "efficacy", "medCosts", "hrhUnitCosts", "hrhProtocols", "seProfiles", "inpatient", "effectChain", "thresholds", "comparators", "demand", "params", "meta"] as const;
const dir = (layer: string) => fileURLToPath(new URL(`../data/${layer}/`, import.meta.url));
const readLayer = (layer: string) => Object.fromEntries(FILES.map((f) => [f, JSON.parse(readFileSync(dir(layer) + f + ".json", "utf8"))])) as Record<(typeof FILES)[number], any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const toDataset = (raw: ReturnType<typeof readLayer>): Dataset => datasetFromJson(Object.fromEntries(FILES.map((f) => [f + "Json", raw[f]])) as RawData);

const pub = readLayer("public");
const ds = toDataset(pub);
const build = pub.meta.publicBuild as { disclosure: "label-only" | "full"; label: string; built: string; banner?: string } | undefined;
const HAS_PRIVATE = existsSync(dir("v32") + "meta.json");
// The withheld index: under full disclosure it ships in meta.publicBuild; under label-only it is the private sidecar
// data/public/withheld-index.json (not exported), so these checks run in the private repo only.
interface Index { withheld: Record<string, string>; rules: { family: string; country: string; action: string; select?: { sourceLabel?: string } }[]; withheldSources: Record<string, Record<string, string[]>> }
const SIDECAR = dir("public") + "withheld-index.json";
const index: Index | null = build?.disclosure === "full" ? (pub.meta.publicBuild as Index) : existsSync(SIDECAR) ? JSON.parse(readFileSync(SIDECAR, "utf8")) : null;
const HAS_INDEX = index != null;
const withheldIds = (intId: string, c: string) => index?.withheldSources?.[intId]?.[c] ?? [];
const walkStrings = (o: unknown, path = "", out: [string, string][] = []): [string, string][] => {
  if (typeof o === "string") out.push([path, o]);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walkStrings(v, `${path}/${k}`, out);
  return out;
};

describe("public data layer: withheld values are absent", () => {
  it("carries a publicBuild block with the public label", () => {
    expect(build).toBeTruthy();
    expect(build!.label).toBe("Public version");
    if (build!.disclosure === "full") expect(build!.banner).toMatch(/^Public version/);
  });

  it.runIf(build?.disclosure !== "full")("label-only: nothing in the public data says what was withheld", () => {
    const hits = FILES.flatMap((f) => walkStrings(pub[f], f)).filter(([, v]) => /withheld|clearance|public sources|redact/i.test(v));
    expect(hits.map(([p, v]) => `${p}: ${v.slice(0, 80)}`)).toEqual([]);
    const keys = JSON.stringify(pub).match(/"(withheld|withheldFields|withheldNote|withheldSources)":/g) ?? [];
    expect(keys).toEqual([]);
  });

  it.runIf(HAS_INDEX)("every indexed withheld path is null in the dataset the app loads", () => {
    expect(Object.keys(index!.withheld).length).toBeGreaterThan(0);
    for (const p of Object.keys(index!.withheld)) expect(getAt(ds, p), p).toBeNull();
  });

  it("every row flagged withheld has its withheld fields null", () => {
    for (const [f, data] of Object.entries(pub)) {
      const visit = (o: unknown, path: string): void => {
        if (!o || typeof o !== "object") return;
        const r = o as Record<string, unknown>;
        if (r.withheld === true) for (const k of r.withheldFields as string[]) expect(r[k], `${f}${path}/${k}`).toBeNull();
        for (const [k, v] of Object.entries(r)) visit(v, `${path}/${k}`);
      };
      visit(data, "");
    }
  });

  it.runIf(HAS_INDEX)("no remaining price source matches a fall-through rule, and withheld sources are gone from their cell", () => {
    const rules = index!.rules.filter((r) => r.family === "medCosts" && r.action === "fallthrough-tier");
    expect(rules.length).toBeGreaterThan(0);
    for (const m of ds.medCosts) {
      for (const c of COUNTRIES) {
        const rows = m.priceSources?.[c] ?? [];
        for (const id of withheldIds(m.intId, c)) expect(rows.some((r) => r.id === id && !r.id.startsWith("public-")), `${m.name} ${c} ${id}`).toBe(false);
        for (const r of rows) for (const rule of rules) {
          if (rule.country !== "*" && rule.country !== c) continue;
          const re = rule.select?.sourceLabel ? new RegExp(rule.select.sourceLabel) : null;
          if (re) expect(re.test(r.label) || re.test(r.ref ?? ""), `${m.name} ${c}: ${r.label}`).toBe(false);
        }
      }
    }
  });

  it.runIf(HAS_PRIVATE && HAS_INDEX)("no withheld private value survives anywhere in its product's public prices (cross-check with data/v32)", () => {
    const priv = toDataset(readLayer("v32"));
    let checked = 0;
    for (const [i, m] of ds.medCosts.entries()) {
      const pm = priv.medCosts[i];
      expect(pm.intId).toBe(m.intId);
      for (const c of COUNTRIES) {
        const kept = new Set((pm.priceSources?.[c] ?? []).filter((r) => (m.priceSources?.[c] ?? []).some((q) => q.id === r.id)).map((r) => r.priceUsd));
        const gone = withheldIds(m.intId, c).map((id) => (pm.priceSources?.[c] ?? []).find((r) => r.id === id)?.priceUsd).filter((v): v is number => typeof v === "number" && !kept.has(v));
        const shown = [...(m.priceSources?.[c] ?? []).map((r) => r.priceUsd), ...Object.values(m.prices[c] ?? {})].filter((v): v is number => typeof v === "number");
        for (const v of gone) { checked++; expect(shown.some((x) => Math.abs(x - v) <= 1e-12 * Math.max(1, v)), `${m.name} ${c} still shows ${v}`).toBe(false); }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it.runIf(HAS_PRIVATE)("keeps every array the same length as data/v32, so data packs map to the same rows", () => {
    const priv = toDataset(readLayer("v32")) as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(ds)) if (Array.isArray(v)) expect(v.length, k).toBe((priv[k] as unknown[]).length);
  });
});

describe("public data layer: the engine runs in every country", () => {
  for (const c of COUNTRIES) for (const comparator of ["Current treatment", "No treatment"] as const) {
    it(`${c} · ${comparator}`, () => {
      const s = { ...defaultScenario(ds, c), comparator };
      const r = analyze(s, ds);
      expect(r.products.length).toBeGreaterThan(20);
      for (const p of r.products) {
        expect(Number.isFinite(p.total), `${p.name} total`).toBe(true);
        expect(Number.isFinite(p.netDalys), `${p.name} DALYs`).toBe(true);
        if (p.included) expect(p.price.unitPrice, `${p.name} has a public price in ${c}`).toBeGreaterThan(0);
      }
      expect(r.cabinet.length).toBe(4);
      expect(() => ejpTable(r)).not.toThrow();
      expect(() => budgetImpact(r, ds)).not.toThrow();
      expect(() => tornado(r, ds, s.sensitivitySubject)).not.toThrow();
    });
  }
});
