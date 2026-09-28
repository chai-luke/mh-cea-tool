// Medication budget impact (Calc-BIA / Budget Impact). Medication only unless costBasis = "Total".
import type { Dataset } from "./dataset";
import type { AnalysisResult, BiaResult, MixBasis, UseCategory } from "./types";

const eq = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
const n0 = (x: number | null | undefined) => (typeof x === "number" && !Number.isNaN(x) ? x : 0);

export function budgetImpact(r: AnalysisResult, ds: Dataset): BiaResult {
  const s = r.scenario; const b = s.bia; const fx = r.fx;
  const f = ds.funnel.find((x) => x.country === s.country);
  const empty: BiaResult = { applicable: false, funnel: [], epiNeed: 0, currentBudget: null, currentBudgetVerified: false, slots: [], productLines: [],
    totals: { sqPatientYears: 0, goalPatientYears: 0, fundedPatientYears: 0, sqBudget: 0, goalBudget: 0, fundedBudget: 0 }, kpi: { costPerPatientYear: null, headroom: null, pctOfCurrent: null },
    demandReference: { treatedRetainedSq: null, treatedRetainedGoal: null, fundingRatePerPy: null } };
  if (!f || f.adultPop == null || f.prevalence == null || !f.schizShareOfPsychosis) return empty;

  // funnel
  const epiNeed = f.adultPop * f.prevalence / f.schizShareOfPsychosis;
  const diag = b.diagnosisRateSqOverride ?? n0(f.diagnosisRateSq);
  const txInit = n0(f.txInitRateSq); const ret = n0(f.retentionSq);
  const target = b.goalCoverageOverride ?? n0(f.goalCoverageTarget);
  const cut = Math.pow(target, 1 / 3);
  const userBudget = b.currentBudgetUsd;
  const currentBudget = userBudget != null ? userBudget : f.currentBudgetUsd != null ? f.currentBudgetUsd * fx : null;
  const sqMedCost = f.sqMedCostUsd != null ? f.sqMedCostUsd * fx : null;
  // A sourced budget whose scope is unverified (Src-Demand M ≠ Yes) is not used anywhere: Funded = Status Quo.
  // (17 Sep 2026: the RW/NG/SA lines are not antipsychotic-scoped — RW reads $67.8M against $1.6k of medication spend.)
  const verified = userBudget != null || eq(f.budgetScopeVerified, "Yes");
  const funded = !sqMedCost || !verified || currentBudget == null ? 1 : Math.min(currentBudget / sqMedCost, 1);
  const py = (init: number, retn: number) => init * (1 + retn) / 2;
  const sqDiag = epiNeed * diag, sqInit = sqDiag * txInit, sqPy = py(sqInit, ret);
  const gDiag = epiNeed * cut, gInit = gDiag * cut, gPy = py(gInit, cut);
  const fDiag = sqDiag * funded, fInit = fDiag * txInit, fPy = py(fInit, ret);
  const funnel: BiaResult["funnel"] = [
    { scenario: "Status Quo", diagnosisRate: diag, diagnosed: sqDiag, txInitRate: txInit, initiating: sqInit, retention: ret, effectivePatientYears: sqPy },
    { scenario: "Goal", diagnosisRate: cut, diagnosed: gDiag, txInitRate: cut, initiating: gInit, retention: cut, effectivePatientYears: gPy },
    { scenario: "Funded", diagnosisRate: diag, diagnosed: fDiag, txInitRate: txInit, initiating: fInit, retention: ret, effectivePatientYears: fPy },
  ];

  // slots and product lines
  const byName = new Map(r.products.map((p) => [p.name.toLowerCase(), p]));
  const slots: BiaResult["slots"] = []; const lines: BiaResult["productLines"] = [];
  r.cabinet.forEach((slot, i) => {
    const uc = slot.useCategory as UseCategory;
    const split = n0(b.splits[uc]);
    const basis: MixBasis = b.mixBasisByCategory[uc] ?? b.mixBasis;
    const sqPat = sqPy * split, gPat = gPy * split, fPat = fPy * split;
    // product list: CE-optimised -> the cabinet product at share 1; else mix rows for (country, category)
    const rows = basis === "CE-optimised"
      ? (slot.product ? [{ product: slot.product, normalizedShare: 1 }] : [])
      : ds.mixDefaults.filter((m) => m.country === s.country && eq(m.useCategory, uc)).slice(0, 6).map((m) => ({ product: m.product, normalizedShare: n0(m.normalizedShare) }));
    for (const extra of b.extraProducts?.[uc] ?? []) if (!rows.some((x) => eq(x.product, extra))) rows.push({ product: extra, normalizedShare: 0 });
    let sqB = 0, gB = 0, fB = 0;
    for (const row of rows) {
      const p = byName.get(row.product.toLowerCase());
      if (!p) continue;
      const unitPrice = p.price.unitPrice; const units = p.annualUnits; const medGross = unitPrice * units;
      const adh = b.adherenceApplied ? p.adherence : 1;
      const consumed = medGross * adh;
      const costBasis = b.costBasis === "Total" ? p.total : consumed;
      const procurement = costBasis * (1 + b.wastage);
      const ovr = b.productShareOverrides[row.product];
      const effectiveShare = typeof ovr === "number" ? (split > 0 ? ovr / split : 0) : basis === "CE-optimised" ? 1 : row.normalizedShare;
      const l = { useCategory: uc, product: row.product, defaultShare: row.normalizedShare, effectiveShare, shareOfAll: split * effectiveShare, unitPrice, units, medGross, adherence: adh, consumed, costBasisPerPtYr: costBasis, procurementPerPtYr: procurement,
        sqBudget: sqPat * effectiveShare * procurement, goalBudget: gPat * effectiveShare * procurement, fundedBudget: fPat * effectiveShare * procurement };
      lines.push(l); sqB += l.sqBudget; gB += l.goalBudget; fB += l.fundedBudget;
    }
    slots.push({ slot: i + 1, useCategory: uc, product: slot.product, split, sqPatients: sqPat, goalPatients: gPat, fundedPatients: fPat, sqBudget: sqB, goalBudget: gB, fundedBudget: fB, basis });
  });
  const totals = { sqPatientYears: sqPy, goalPatientYears: gPy, fundedPatientYears: fPy, sqBudget: slots.reduce((a, x) => a + x.sqBudget, 0), goalBudget: slots.reduce((a, x) => a + x.goalBudget, 0), fundedBudget: slots.reduce((a, x) => a + x.fundedBudget, 0) };
  return {
    applicable: true, funnel, epiNeed, currentBudget, currentBudgetVerified: verified, slots, productLines: lines, totals,
    kpi: { costPerPatientYear: sqPy > 0 ? totals.sqBudget / sqPy : null, headroom: verified && currentBudget != null ? currentBudget - totals.sqBudget : null, pctOfCurrent: verified && currentBudget ? totals.sqBudget / currentBudget : null },
    demandReference: { treatedRetainedSq: f.treatedRetainedSq, treatedRetainedGoal: f.treatedRetainedGoal, fundingRatePerPy: f.fundingRatePerPy },
  };
}
