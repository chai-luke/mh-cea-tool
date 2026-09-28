// Core domain types for the MH CEA engine (workbook v32 semantics).
// UI-free and pure. See docs/engine-spec-v32.md for the cell-by-cell mapping.

export type Country = "Ethiopia" | "Nigeria" | "Rwanda" | "South Africa" | "Ghana";
export type ComparatorMode = "Current treatment" | "No treatment";
export type ThresholdMethod =
  | "Pichon-Riviere (supply-side)"
  | "Ochalek (supply-side)"
  | "1x GDP per capita"
  | "National (SA domestic)"
  | "Custom";
export type Costing = "Consumed doses only" | "Full course (incl. wastage)";
export type Anchor = "Comparator-rebased" | "Untreated baseline";
export type TfMethod = "Proportional" | "Absolute (Andrews literal)";
export type MixBasis = "Current tx (incumbent)" | "CE-optimised";
export type UseCategory = "Initiation + Maintenance" | "Maintenance" | "Treatment-resistant" | "Acute agitation";

export const USE_CATEGORIES: UseCategory[] = ["Initiation + Maintenance", "Maintenance", "Treatment-resistant", "Acute agitation"];
export const COUNTRIES: Country[] = ["Ethiopia", "Nigeria", "Rwanda", "South Africa"];

/** Everything a user can set. Mirrors Setup + Control overrides + Products + Scenario/BIA inputs. */
export interface Scenario {
  country: Country;
  comparator: ComparatorMode;
  /** per use category, product name or null (= country grid default) */
  comparatorOverrides: Partial<Record<UseCategory, string | null>>;
  thresholdMethod: ThresholdMethod;
  customThreshold: number | null;
  includeAdmin: boolean;
  adminPct: number;
  currency: "USD" | "LCU";
  costing: Costing;
  hospChannel: boolean;
  anchor: Anchor;
  tfMethod: TfMethod;
  tfFloor: boolean;
  /** survival channel: treated-vs-untreated all-cause mortality HR (Correll 2022) for every treated product */
  mortalityScenario: boolean;
  /** product layers on top of the channel: LAI-vs-oral OR (Aymerich 2024) and clozapine HR; a scenario, not base case (owner decision 18 Sep 2026) */
  mortalityProductLayers: boolean;
  /** legacy P_ADM_DIFF; forced 1.0 while hospChannel is on */
  admDiffLegacy: boolean;
  rwMultiplier: number;
  adherence: { oral: number; lai: number; im: number; cobenfy: number };
  cpiInflate: boolean;
  /** Int_ID -> included */
  included: Record<string, boolean>;
  /** Int_ID -> user unit price (USD); blank/0 ignored like the workbook */
  userUnitPrice: Record<string, number | null>;
  /** Scenario tab: expected admissions per patient-year (null = country default) */
  admissionsRiskInput: number | null;
  headToHead: { a: string; b: string };
  sensitivitySubject: string;
  /** Sensitivity comparator override (null = the engine comparator for the selected product) */
  sensitivityComparator: string | null;
  /** user overrides of tornado low/high bounds, keyed by parameter label */
  sensitivityBounds: Record<string, { low: number | null; high: number | null }>;
  bia: BiaInputs;
}

export interface BiaInputs {
  currentBudgetUsd: number | null;
  wastage: number;
  adherenceApplied: boolean;
  costBasis: "Medication only" | "Total";
  mixBasis: MixBasis;
  /** per-category basis override; null = scenario.bia.mixBasis */
  mixBasisByCategory: Partial<Record<UseCategory, MixBasis | null>>;
  /** category split of patient-years (must sum to 1) */
  splits: Record<UseCategory, number>;
  diagnosisRateSqOverride: number | null;
  goalCoverageOverride: number | null;
  /** product name -> share of ALL patient-years (user share); null = default */
  productShareOverrides: Record<string, number | null>;
  /** products added to a category's mix table beyond the defaults (default share 0) */
  extraProducts: Partial<Record<UseCategory, string[]>>;
}

export type CeBasis = "Current tx" | "Less costly, less effective" | "Dominant (cost-saving)" | "Dominated" | "Incremental";
export type HeadlineLabel = "Reference" | "(less costly, less effective)" | "(dominant, cost-saving)" | "(dominated)";
export type CeStatus = "Very CE" | "CE" | "Not CE" | "Current tx" | "Dominated" | "Dominant (cost-saving)" | "SW quadrant" | "";

export interface PriceResolution {
  unitPrice: number;          // effective (× FX)
  defaultUnitPrice: number;   // chain without the user override
  userOverride: number | null;
  /** "tier-default" / "selected-source" = a Src-Med Price Sources row (17 Sep 2026); the rest = the legacy 4-column chain. */
  basisUsed: "user" | "tier-default" | "selected-source" | "selected-basis" | "min-in-country-block" | "other-default" | "none";
  tier: string | null;
  source: string | null;
  /** id of the PriceSource row in effect (null on the legacy chain). */
  sourceId: string | null;
}

export interface ProductResult {
  intId: string;
  name: string;
  category: string;
  formulation: string;
  use: string;               // Library G
  dashboardUse: string;      // Library G or "(not panel-recommended)"
  included: boolean;
  whoEml: string | null;
  nationalEml: string | null;
  price: PriceResolution;
  annualUnits: number;
  unitsPerAdmin: number;
  adminsPerYr: number;
  // cost chain
  medGross: number;          // D
  adherence: number;         // E
  medCosted: number;         // F
  hrhInitial: number;        // G
  hrhMaintenance: number;    // H
  inpatient: number;         // I
  seCost: number;            // J
  admin: number;             // K
  total: number;             // L
  wastage: number;           // AH
  rrOnTx: number;            // AI
  rrEff: number;             // AJ
  untreatedAdmission: number;// AK
  // effect chain
  baselineDw: number;        // M
  smd: number;               // N
  transferFactor: number;    // Q
  grossDalys: number;        // R
  seDecrement: number;       // S
  mortalityDalys: number;    // T
  netDalys: number;          // U
  absolutePerDaly: number | null; // V
  perDalyExInpatient: number | null; // W
  ceAbsolute: "Very CE" | "CE" | "Not CE" | "";
  // comparator block
  comparator: string;        // Z
  compNetDalys: number | null;
  compTotal: number | null;
  deltaDalys: number | null; // AC
  deltaCost: number | null;  // AD
  icerVsComparator: number | null; // AE
  ceBasis: CeBasis | "";     // AF
  headline: HeadlineLabel | number | ""; // AG
  // Detailed Results
  ceStatus: CeStatus;        // T
  nmb: number | null;        // W
  rank: number | null;       // V
}

export interface NoTreatmentResult {
  inpatient: number;
  total: number;
  rrEff: number;
  untreatedAdmission: number;
}

export interface CabinetSlot {
  slot: number;
  useCategory: UseCategory;
  product: string | null;
  headline: HeadlineLabel | number | "" | null;
  ceBasis: CeBasis | "" | null;
  whoEml: string | null;
}

export interface ThresholdResult {
  value: number | null;      // in display currency
  valueUsd: number | null;
  method: ThresholdMethod;
  flag: string | null;       // e.g. "NO THRESHOLD — country pending"
  source: string | null;
}

export interface AnalysisResult {
  scenario: Scenario;
  fx: number;
  currencySymbol: string;
  threshold: ThresholdResult;
  products: ProductResult[];          // Library order
  noTreatment: NoTreatmentResult;
  ranked: ProductResult[];            // rank 1..n (included only)
  cabinet: CabinetSlot[];
  countryInputs: {
    admissionProb: number; losDays: number; costPerDayUsd: number; costPerDay: number;
    gridComparators: Record<UseCategory, string>;
  };
  flags: string[];
}

export interface EjpRow {
  product: string;
  use: string;
  /** The product this row's EJP is struck against (its use category's current treatment, or No treatment). */
  comparator: string;
  defaultUnitPrice: number;
  ejpPerUnit: number | "Reference" | "no break-even" | "";
  ejpPerYear: number | null;
  ejpPctOfDefault: number | null;
  ceLabel: CeStatus;
  note: string;
}

export interface HeadToHeadResult {
  a: string; b: string;
  rows: { label: string; a: number; b: number }[];
  deltaCost: number; deltaDalys: number;
  icer: number | HeadlineLabel | "(n/a)";
  inmb: number | null;
  verdict: string;
  totalAStar: number | null;
  breakEvenUnitPrice: number | null;
  medCostAtPStar: number | null;
  pStarPctOfDefault: number | null;
  interpretation: string;
}

export interface BiaResult {
  applicable: boolean;
  funnel: { scenario: "Status Quo" | "Goal" | "Funded"; diagnosisRate: number; diagnosed: number; txInitRate: number; initiating: number; retention: number; effectivePatientYears: number }[];
  epiNeed: number;
  currentBudget: number | null;
  currentBudgetVerified: boolean;
  slots: { slot: number; useCategory: UseCategory; product: string | null; split: number; sqPatients: number; goalPatients: number; fundedPatients: number; sqBudget: number; goalBudget: number; fundedBudget: number; basis: MixBasis }[];
  productLines: { useCategory: UseCategory; product: string; defaultShare: number; effectiveShare: number; shareOfAll: number; unitPrice: number; units: number; medGross: number; adherence: number; consumed: number; costBasisPerPtYr: number; procurementPerPtYr: number; sqBudget: number; goalBudget: number; fundedBudget: number }[];
  totals: { sqPatientYears: number; goalPatientYears: number; fundedPatientYears: number; sqBudget: number; goalBudget: number; fundedBudget: number };
  kpi: { costPerPatientYear: number | null; headroom: number | null; pctOfCurrent: number | null };
  demandReference: { treatedRetainedSq: number | null; treatedRetainedGoal: number | null; fundingRatePerPy: number | null };
}

export interface TornadoRow {
  parameter: string;
  scope: "Global" | "Drug" | "Scenario";
  base: number | null; low: number | null; high: number | null;
  icerAtLow: number | string; icerAtHigh: number | string;
  swing: number | null;
}

export interface SensitivityResult {
  subject: string; comparator: string; baseIcer: number | string; rows: TornadoRow[];
}
