// Display order (owner decision 18 Sep 2026): indicated use → class → A to Z, everywhere except the ranked table.
import { describe, expect, it } from "vitest";
import { analyze, defaultDataset, defaultScenario } from "../src/engine";
import { comparatorsInEffect, groupLabels, namesInDisplayOrder, sortDisplay, useLabelOf } from "../src/app/format";

const ds = defaultDataset();
const r = analyze(defaultScenario(ds, "Ethiopia"), ds);

describe("display order", () => {
  it("groups by indicated use in the cabinet order, then class, then A to Z", () => {
    const names = namesInDisplayOrder(r.products);
    const labels = sortDisplay(r.products).map(useLabelOf);
    const firstIdx = (l: string) => labels.indexOf(l);
    expect(firstIdx("Initiation + Maintenance")).toBeLessThan(firstIdx("Maintenance"));
    expect(firstIdx("Maintenance")).toBeLessThan(firstIdx("Treatment-resistant"));
    expect(firstIdx("Treatment-resistant")).toBeLessThan(firstIdx("Acute agitation"));
    // contiguous groups
    for (let i = 1; i < labels.length; i++) if (labels[i] !== labels[i - 1]) expect(labels.slice(i).includes(labels[i - 1])).toBe(false);
    // first group: first-generation orals A to Z, then second-generation orals, then Cobenfy
    expect(names.slice(0, 3)).toEqual(["Chlorpromazine (oral)", "Haloperidol (oral)", "Trifluoperazine (oral)"]);
    expect(names[3]).toBe("Amisulpride (oral)");
    expect(names[labels.lastIndexOf("Initiation + Maintenance")]).toBe("Cobenfy (KarXT)");
    // maintenance: first-generation depots before second-generation LAIs
    const m = names.filter((_, i) => labels[i] === "Maintenance");
    expect(m.slice(0, 4)).toEqual(["Flupenthixol decanoate (LAI)", "Fluphenazine decanoate (LAI)", "Haloperidol decanoate (LAI)", "Zuclopenthixol decanoate (LAI)"]);
    expect(m[4]).toBe("Aripiprazole (LAI)");
    expect(names[names.length - 1]).toBe("Olanzapine (IM, short-acting)");
  });
  it("rows without use/class (medicine costs) sort by their library product", () => {
    const byCost = sortDisplay(ds.medCosts).map((m) => m.name);
    expect(byCost).toEqual(namesInDisplayOrder(r.products));
  });
  it("group labels and comparators in effect line up with the cabinet grid", () => {
    const g = groupLabels(r.products);
    expect(g["Haloperidol decanoate (LAI)"]).toBe("Maintenance");
    const c = comparatorsInEffect(r.scenario, r);
    expect(c["Initiation + Maintenance"]).toBe("Risperidone (oral)");
    expect(c["Acute agitation"]).toBe("Haloperidol (IM, short-acting)");
    const nt = analyze({ ...defaultScenario(ds, "Ethiopia"), comparator: "No treatment" }, ds);
    expect(comparatorsInEffect(nt.scenario, nt)["Maintenance"]).toBe("No treatment");
  });
});
