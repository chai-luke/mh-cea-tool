// Public data layer (data/public, written by tools/build_public.py). The private build carries no `publicBuild` block, so
// everything here is inert there.
//   disclosure "label-only" (default): the app only says "Public version" (Home chip, Guide line). Nothing lists withheld items.
//   disclosure "full": withheld inputs are indexed by dataset path ("funnel/0/currentBudgetUsd", the path the Sources cells
//   bind to) and shown with a grey chip, withheld price sources are listed, and Home / CE Dashboard carry a banner.
import metaJson from "@data/meta.json";

export interface PublicBuildInfo {
  disclosure: "label-only" | "full"; label: string; built: string;
  // full disclosure only
  preset?: string | null; banner?: string; withheldNote?: string; withheldCount?: number; withheldSourceCount?: number; withheld?: Record<string, string>;
}

export const PUBLIC_BUILD: PublicBuildInfo | null = (metaJson as { publicBuild?: PublicBuildInfo }).publicBuild ?? null;
export const IS_PUBLIC = PUBLIC_BUILD != null;
/** Withheld items are shown to the user (chips, rows, banner) only under full disclosure. */
export const DISCLOSE_WITHHELD = PUBLIC_BUILD?.disclosure === "full";
export const PUBLIC_LABEL = PUBLIC_BUILD?.label ?? "Public version";
export const WITHHELD_NOTE = PUBLIC_BUILD?.withheldNote ?? "Withheld pending country data clearance; enter your own value on Sources";

/** Note for a withheld dataset path, or null (always null unless disclosure is full). */
export function withheldAt(path: string): string | null {
  return PUBLIC_BUILD?.withheld?.[path] ?? null;
}

/** Number of withheld paths under any of the given prefixes (a Sources page's `prefixes`). */
export function withheldUnder(prefixes: string[]): number {
  const w = PUBLIC_BUILD?.withheld;
  if (!w) return 0;
  return Object.keys(w).filter((p) => prefixes.some((pre) => p === pre || p.startsWith(pre + "/"))).length;
}

/** A price source removed from the public data (label and tier only; full disclosure only). */
export interface WithheldSource { id: string; label: string; tier: string; rule: string; note: string }
