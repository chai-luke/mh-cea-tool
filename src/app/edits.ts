// Dataset edits: a flat map of "a/b/0/c" paths -> values, applied over the workbook defaults.
// Paths index arrays by position, which is stable because the tool never adds or removes rows.
import type { Dataset } from "../engine";

export type Edits = Record<string, unknown>;

export const P = (...parts: (string | number)[]) => parts.join("/");

export function getAt(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const s of path.split("/")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[s];
  }
  return cur;
}

export function setAt(obj: unknown, path: string, value: unknown): void {
  const parts = path.split("/");
  let cur = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function applyEdits(base: Dataset, edits: Edits): Dataset {
  const keys = Object.keys(edits);
  if (!keys.length) return base;
  const clone = structuredClone(base) as Dataset;
  for (const k of keys) setAt(clone, k, edits[k]);
  return clone;
}

export function editsUnder(edits: Edits, prefixes: string[]): string[] {
  return Object.keys(edits).filter((p) => prefixes.some((pre) => p === pre || p.startsWith(pre + "/")));
}
