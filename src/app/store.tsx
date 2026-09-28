import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { analyze, defaultDataset, defaultScenario, type AnalysisResult, type BiaInputs, type Country, type Dataset, type Scenario } from "../engine";
import { applyEdits, type Edits } from "./edits";
import { MODEL_VERSION, SETTINGS_VERSION, WORKBOOK } from "./version";

export type ScreenId = "home" | "setup" | "products" | "dash" | "scen" | "bia" | "sens" | "guide" | "sources";
export type SourcePage = "index" | "medicine-costs" | "staffing" | "protocols" | "efficacy" | "side-effects" | "inpatient" | "demand" | "thresholds" | "comparators" | "library";

export const BASE: Dataset = defaultDataset();
const STORAGE_KEY = `mh-cea-tool-state-v${SETTINGS_VERSION}`; // keyed by settings version: a defaults change starts every browser from the new defaults
export const PACK_FORMAT = "mh-cea-data-pack";

interface Persisted { workbook: string; scenario: Partial<Scenario>; edits: Edits }

function mergeScenario(saved: Partial<Scenario> | undefined): Scenario {
  const d = defaultScenario(BASE);
  if (!saved) return d;
  const bia = saved.bia as Partial<BiaInputs> | undefined;
  return {
    ...d, ...saved,
    adherence: { ...d.adherence, ...(saved.adherence ?? {}) },
    included: { ...d.included, ...(saved.included ?? {}) },
    userUnitPrice: { ...d.userUnitPrice, ...(saved.userUnitPrice ?? {}) },
    comparatorOverrides: { ...(saved.comparatorOverrides ?? {}) },
    sensitivityBounds: { ...(saved.sensitivityBounds ?? {}) },
    bia: { ...d.bia, ...(bia ?? {}), splits: { ...d.bia.splits, ...(bia?.splits ?? {}) }, mixBasisByCategory: { ...(bia?.mixBasisByCategory ?? {}) }, productShareOverrides: { ...(bia?.productShareOverrides ?? {}) }, extraProducts: { ...(bia?.extraProducts ?? {}) } },
  };
}

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    if (p.workbook !== WORKBOOK) return null;
    return p;
  } catch { return null; }
}

export interface DataPack { format: string; version: number; workbook: string; modelVersion: string; exported: string; edits: Edits; scenario?: Scenario; note?: string }

interface Store {
  scenario: Scenario;
  setScenario: (patch: Partial<Scenario>) => void;
  setBia: (patch: Partial<BiaInputs>) => void;
  setCountry: (c: Country) => void;
  resetScenario: () => void;
  baseDataset: Dataset;
  dataset: Dataset;
  edits: Edits;
  setEdit: (path: string, value: unknown) => void;
  clearEdit: (path: string) => void;
  clearEdits: (paths?: string[]) => void;
  exportPack: (includeScenario: boolean) => DataPack;
  importPack: (text: string) => string | null;
  result: AnalysisResult;
  screen: ScreenId;
  go: (s: ScreenId) => void;
  srcPage: SourcePage;
  goSrc: (p: SourcePage) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const persisted = useMemo(loadPersisted, []);
  const [scenario, setScenarioState] = useState<Scenario>(() => mergeScenario(persisted?.scenario));
  const [edits, setEdits] = useState<Edits>(() => persisted?.edits ?? {});
  const [screen, setScreen] = useState<ScreenId>("home");
  const [srcPage, setSrcPage] = useState<SourcePage>("index");

  const dataset = useMemo(() => applyEdits(BASE, edits), [edits]);
  const result = useMemo(() => analyze(scenario, dataset), [scenario, dataset]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ workbook: WORKBOOK, scenario, edits } satisfies Persisted)); } catch { /* storage unavailable */ }
  }, [scenario, edits]);

  const setScenario = (patch: Partial<Scenario>) => setScenarioState((prev) => ({ ...prev, ...patch }));
  const setBia = (patch: Partial<BiaInputs>) => setScenarioState((prev) => ({ ...prev, bia: { ...prev.bia, ...patch } }));
  const setCountry = (c: Country) => setScenarioState((prev) => ({ ...prev, country: c, comparatorOverrides: {}, bia: { ...prev.bia, currentBudgetUsd: null, diagnosisRateSqOverride: null, goalCoverageOverride: null, productShareOverrides: {} } }));
  const resetScenario = () => setScenarioState((prev) => defaultScenario(BASE, prev.country));

  const setEdit = (path: string, value: unknown) => setEdits((prev) => ({ ...prev, [path]: value }));
  const clearEdit = (path: string) => setEdits((prev) => { const n = { ...prev }; delete n[path]; return n; });
  const clearEdits = (paths?: string[]) => setEdits((prev) => { if (!paths) return {}; const n = { ...prev }; for (const p of paths) delete n[p]; return n; });

  const exportPack = (includeScenario: boolean): DataPack => ({
    format: PACK_FORMAT, version: 1, workbook: WORKBOOK, modelVersion: MODEL_VERSION, exported: new Date().toISOString(),
    edits, ...(includeScenario ? { scenario } : {}),
    note: "Edits are paths into the tool's source dataset. Import via Sources → Import data pack.",
  });
  const importPack = (text: string): string | null => {
    try {
      const p = JSON.parse(text) as Partial<DataPack>;
      if (p.format !== PACK_FORMAT || !p.edits || typeof p.edits !== "object") return "Not a data pack from this tool.";
      if (p.workbook && p.workbook !== WORKBOOK) return `Pack was made for data release ${p.workbook}; this tool runs on ${WORKBOOK}. Import refused to avoid mis-mapped values.`;
      setEdits(p.edits);
      if (p.scenario) setScenarioState(mergeScenario(p.scenario));
      return null;
    } catch (e) { return `Could not read the file: ${(e as Error).message}`; }
  };

  const go = (s: ScreenId) => { setScreen(s); if (s === "sources") setSrcPage("index"); window.scrollTo({ top: 0 }); };
  const goSrc = (p: SourcePage) => { setScreen("sources"); setSrcPage(p); window.scrollTo({ top: 0 }); };

  const value: Store = { scenario, setScenario, setBia, setCountry, resetScenario, baseDataset: BASE, dataset, edits, setEdit, clearEdit, clearEdits, exportPack, importPack, result, screen, go, srcPage, goSrc };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}
