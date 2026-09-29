import paramsJson from "@data/params.json";
import metaJson from "@data/meta.json";

export const MODEL_VERSION: string = (paramsJson as { modelVersion: string }).modelVersion;
export const VERSION_STAMP: string = (paramsJson as { versionStamp: string }).versionStamp;
export const WORKBOOK: string = (metaJson as { workbook: string }).workbook;
export const WORKBOOK_SAVED: string = (metaJson as { workbook_saved: string }).workbook_saved;
export const TOOL_VERSION = "vS";
export const TOOL_TAG = "September 2026";
export const TOOL_BUILD = "web build 19 · 29 Sep 2026";
/** Bump when the default scenario changes so browsers do not restore stale saved settings over the new defaults (2 = 14 Sep decisions; 3 = 18 Sep survival product layers off). */
export const SETTINGS_VERSION = 3;
