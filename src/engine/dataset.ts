// The data layer the engine runs on. `defaultDataset()` is the workbook extraction (data/v32/*.json);
// the Sources screen deep-clones it and edits values, and every edit carries provenance.

import interventionsJson from "@data/interventions.json";
import productsJson from "@data/products.json";
import efficacyJson from "@data/efficacy.json";
import medCostsJson from "@data/medCosts.json";
import hrhUnitCostsJson from "@data/hrhUnitCosts.json";
import hrhProtocolsJson from "@data/hrhProtocols.json";
import seProfilesJson from "@data/seProfiles.json";
import inpatientJson from "@data/inpatient.json";
import effectChainJson from "@data/effectChain.json";
import thresholdsJson from "@data/thresholds.json";
import comparatorsJson from "@data/comparators.json";
import demandJson from "@data/demand.json";
import paramsJson from "@data/params.json";
import metaJson from "@data/meta.json";

export interface Meta { workbook: string; workbook_saved: string; extracted: string; sheet?: string; note?: string }

export interface Intervention {
  intId: string; name: string; condition: string; category: string; formulation: string; use: string;
  mechanism: string | null; whoEml: string | null; nationalEml: Record<string, string | null>;
  notes: string | null; emlCrosscheck: string | null; source: string | null; panelRecommended: string | null; adminPerYr: number | null;
  /** Optional admission-RR bucket override (Library col T, 17 Sep 2026). Names a row of Src-Inpatient's on-treatment RR table;
   *  blank → the molecule name rule (clozapine / olanzapine / quetiapine / class default). Used so every acute-agitation
   *  product shares the category's class RR. */
  rrBucket?: string | null;
}
export interface ProductRow { intId: string; include: string | null; name: string; defaultUnitCostCached: number | null; userUnitPrice: number | null; costUnit: string | null; sourceCached: string | null; tierCached: string | null }
export interface EfficacyRow { intId: string; name: string; smd: number | null; smdSource: string | null; adherenceRef: number | null; adherenceRefSource: string | null; smdHuhn2019: number | null; notes: string | null }
export interface PriceBlock { cheapest: number | null; average: number | null; negotiated: number | null; bestCrossCountry: number | null }
/** One candidate price for a product in a country (workbook tab Src-Med Price Sources, 17 Sep 2026).
 *  Tier protocol: T1 in-country procurement → T2 India I/E → T3 focus-country proxy → T4 country-adjusted global benchmark.
 *  The default is the lowest tier number, then the lowest `priority`; `default` caches that choice. */
export interface PriceSource { id: string; label: string; tier: string; priceUsd: number; unit: string | null; ref: string | null; note?: string | null; priority: number; default?: boolean }
export interface MedCostRow {
  intId: string; name: string; formulation: string; dosingGuideline: string | null; injectable: string | null; strengthMg: number | null; doseMg: number | null; frequency: string | null;
  unitsPerAdminCached: number | null; adminsPerYrCached: number | null; annualUnitsCached: number | null; dosingSource: string | null;
  prices: Record<string, PriceBlock>; priceNotes: Record<string, string> | null; crossCountryBest: number | null; otherDefault: number | null; otherDefaultSource: string | null;
  effectiveUnitPriceCached: number | null; tiers: Record<string, { tier: string | null; source: string | null }>;
  /** Selectable price sources per country; absent/empty → the legacy 4-column chain applies. */
  priceSources?: Record<string, PriceSource[]>;
  /** User's pick per country (a PriceSource id); null/absent → the hierarchy default. Edited on Sources → Medicine costs. */
  selectedSource?: Record<string, string | null>;
  /** Public data layer only (tools/build_public.py): sources removed pending country clearance. Label and tier, no value. */
  withheldSources?: Record<string, { id: string; label: string; tier: string; rule: string; note: string }[]>;
}
export interface UnitCostRow { country: string; provider: string; annualCoeLcu: number | null; currency: string | null; fx: number | null; annualCoeUsd: number | null; workHrsPerYr: number | null; onCostRate: number | null; costPerMinUsd: number | null; costPerMinClean: number | null; source: string | null; notes: string | null }
export interface ProtocolProvider { provider: string | null; timeMin: number | null; visitsPerYr: number | null; pctReceiving: number | null }
export interface ProtocolRow { intId: string; name: string; visitType: string; byCountry: Record<string, { providers: ProtocolProvider[]; source: string | null }> }
export interface SeBucket { bucket: string; dwDecrement: number | null; low: number | null; high: number | null; mgmtCostUsd: number | null; members: string | null; sourceNote: string | null }
export interface SeCostDetail { drugClass: string; metabolicMonitUsd: number | null; metabolicTxIncidence: number | null; metabolicTxUsd: number | null; epsIncidence: number | null; epsTxUsd: number | null; otherSeUsd: number | null; totalSeUsd: number | null; source: string | null }
export interface SeProductMap { intId: string; drugClass: string | null; costBucket: string | null; decrementBucket: string | null; seCostCached: number | null; decrementCached: number | null; rationaleLegacy: string | null }
export interface InpatientRow { country: string; condition: string; admissionProb: number | null; losDays: number | null; costPerDayLcu: number | null; fx: number | null; costPerDayUsd: number | null; source: string | null }
export interface NamedParam { parameter: string | null; value: number | null; low?: number | null; high?: number | null; source: string | null }
export interface RrRow { bucket: string | null; rr: number | null; low: number | null; high: number | null; source: string | null }
export interface ThresholdRow { country: string; usd2026: number | null; year?: number | null; source?: string | null; gdpUsd?: number | null; valueUsd?: number | null }
export interface FxRow { country: string; lcuPerUsd: number | null; currency: string | null; source: string | null }
export interface ComparatorRow { country: string; [useCategory: string]: string | null }
export interface FunnelRow { country: string; adultPop: number | null; prevalence: number | null; schizShareOfPsychosis: number | null; diagnosisRateSq: number | null; txInitRateSq: number | null; retentionSq: number | null; goalCoverageTarget: number | null; currentBudgetUsd: number | null; sqMedCostUsd: number | null; source: string | null; budgetScopeVerified: string | null; treatedRetainedSq: number | null; treatedRetainedGoal: number | null; fundingRatePerPy: number | null; note: string | null }
export interface MixRow { country: string; useCategory: string; product: string; rawShare: number | null; normalizedShare: number | null; note: string | null }
export interface ParamRow { paramId: string; label: string | null; live: unknown; default: unknown; override: unknown; unit: string | null; source: string | null; row: number }

export interface Dataset {
  meta: typeof metaJson;
  interventions: Intervention[];
  products: ProductRow[];
  efficacy: EfficacyRow[];
  medCosts: MedCostRow[];
  selectedPriceBasis: string;                 // Src-Med Costs C5 ("Cheapest")
  frequencyPerYear: Record<string, number | null>;
  hrhUnitCosts: UnitCostRow[];
  hrhProtocols: ProtocolRow[];
  seBuckets: SeBucket[];
  seCostDetail: SeCostDetail[];
  seProductMap: SeProductMap[];
  inpatient: InpatientRow[];
  rrByFormulationLegacy: Record<string, number | null>;
  mortality: NamedParam[];
  admissionRrOnTreatment: RrRow[];
  transferFactors: { condition: string | null; ratingScale: number | null; tto: number | null; applied: number | null; source: string | null; notes: string | null }[];
  effectParams: NamedParam[];
  disabilityWeights: { key: string; dw: number | null; state: string | null; ui95: string | null }[];
  thresholds: { gdpPerCapita: ThresholdRow[]; pichonRiviere: ThresholdRow[]; ochalek: ThresholdRow[]; national: ThresholdRow[]; fx: FxRow[] };
  comparatorGrid: ComparatorRow[];
  funnel: FunnelRow[];
  mixDefaults: MixRow[];
  acuteAssumptions: NamedParam[];
  params: ParamRow[];
  cabinetSlots: string[];                     // Control C67:F67 for schizophrenia
  currencies: { country: string; symbol: string | null; iso: string | null; name: string | null }[];
  provenance: Record<string, Meta>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The data-layer files, keyed as imported above. Values are the parsed JSON (shapes as in data/v32). */
export type RawData = Record<"interventionsJson" | "productsJson" | "efficacyJson" | "medCostsJson" | "hrhUnitCostsJson" | "hrhProtocolsJson" | "seProfilesJson" | "inpatientJson" | "effectChainJson" | "thresholdsJson" | "comparatorsJson" | "demandJson" | "paramsJson" | "metaJson", any>;

const DEFAULT_RAW: RawData = { interventionsJson, productsJson, efficacyJson, medCostsJson, hrhUnitCostsJson, hrhProtocolsJson, seProfilesJson, inpatientJson, effectChainJson, thresholdsJson, comparatorsJson, demandJson, paramsJson, metaJson };

/** The dataset of the data layer this build was compiled with (the @data alias: data/v32 privately, data/public in the public build). */
export function defaultDataset(): Dataset {
  return datasetFromJson(DEFAULT_RAW);
}

/** Build a Dataset from the 14 data-layer JSON files (data/v32 or data/public). */
export function datasetFromJson(raw: RawData): Dataset {
  const { interventionsJson, productsJson, efficacyJson, medCostsJson, hrhUnitCostsJson, hrhProtocolsJson, seProfilesJson, inpatientJson, effectChainJson, thresholdsJson, comparatorsJson, demandJson, paramsJson, metaJson } = raw;
  const cab = ((paramsJson.cabinetConfig) as { condition: string | null; slots: (string | null)[] }[]).find((c) => c.condition === "Schizophrenia");
  return {
    meta: metaJson,
    interventions: interventionsJson.interventions as Intervention[],
    products: productsJson.products as ProductRow[],
    efficacy: efficacyJson.efficacy as EfficacyRow[],
    medCosts: medCostsJson.medCosts as MedCostRow[],
    selectedPriceBasis: (medCostsJson as { selectedBasis: string }).selectedBasis,
    frequencyPerYear: medCostsJson.frequencyPerYear as Record<string, number | null>,
    hrhUnitCosts: hrhUnitCostsJson.unitCosts as UnitCostRow[],
    hrhProtocols: hrhProtocolsJson.protocols as ProtocolRow[],
    seBuckets: seProfilesJson.buckets as SeBucket[],
    seCostDetail: seProfilesJson.costDetail as SeCostDetail[],
    seProductMap: seProfilesJson.productMap as SeProductMap[],
    inpatient: inpatientJson.byCountryCondition as InpatientRow[],
    rrByFormulationLegacy: inpatientJson.rrByFormulationLegacy as Record<string, number | null>,
    mortality: inpatientJson.mortality as NamedParam[],
    admissionRrOnTreatment: inpatientJson.admissionRrOnTreatment as RrRow[],
    transferFactors: effectChainJson.transferFactors as Dataset["transferFactors"],
    effectParams: effectChainJson.parameterBlock as NamedParam[],
    disabilityWeights: effectChainJson.disabilityWeights as Dataset["disabilityWeights"],
    thresholds: {
      gdpPerCapita: thresholdsJson.gdpPerCapita as ThresholdRow[], pichonRiviere: thresholdsJson.pichonRiviere as ThresholdRow[],
      ochalek: thresholdsJson.ochalek as ThresholdRow[], national: thresholdsJson.national as ThresholdRow[], fx: thresholdsJson.fx as FxRow[],
    },
    comparatorGrid: comparatorsJson.grid as ComparatorRow[],
    funnel: demandJson.funnel as FunnelRow[],
    mixDefaults: demandJson.mixDefaults as MixRow[],
    acuteAssumptions: demandJson.acuteAssumptions as NamedParam[],
    params: paramsJson.params as ParamRow[],
    cabinetSlots: (cab?.slots ?? []).filter((s): s is string => !!s),
    currencies: paramsJson.currencies as Dataset["currencies"],
    provenance: {
      interventions: interventionsJson._meta, products: productsJson._meta, efficacy: efficacyJson._meta, medCosts: medCostsJson._meta,
      hrhUnitCosts: hrhUnitCostsJson._meta, hrhProtocols: hrhProtocolsJson._meta, seProfiles: seProfilesJson._meta, inpatient: inpatientJson._meta,
      effectChain: effectChainJson._meta, thresholds: thresholdsJson._meta, comparators: comparatorsJson._meta, demand: demandJson._meta, params: paramsJson._meta,
    } as Record<string, Meta>,
  };
}

/** numeric parameter default from Control (live value at extraction). */
export function paramNumber(ds: Dataset, id: string, fallback: number): number {
  const p = ds.params.find((x) => x.paramId === id);
  const v = p?.live;
  return typeof v === "number" ? v : fallback;
}
export function paramText(ds: Dataset, id: string, fallback: string): string {
  const p = ds.params.find((x) => x.paramId === id);
  const v = p?.live;
  return typeof v === "string" ? v : fallback;
}
export function effectParam(ds: Dataset, startsWith: string): NamedParam | undefined {
  return ds.effectParams.find((p) => (p.parameter ?? "").toLowerCase().startsWith(startsWith.toLowerCase()));
}
export function mortalityParam(ds: Dataset, startsWith: string): number | null {
  return ds.mortality.find((p) => (p.parameter ?? "").toLowerCase().startsWith(startsWith.toLowerCase()))?.value ?? null;
}
