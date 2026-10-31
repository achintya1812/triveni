import type { ClassData, ListeningResult, ProbeResult } from "@triveni/core";
import { describe, expect, it } from "vitest";
import { groupTime, kitLanguage, probeState, probeSteps } from "./group";
import { demoChildren, demoClass, demoData } from "./seed";

const id = (name: string) => demoChildren.find((c) => c.name === name)!.id;
const names = (group: { records: { child: { name: string } }[] } | undefined) => group?.records.map((r) => r.child.name);
const probe = (passedAtOnce: boolean, outcome: Partial<ProbeResult> = {}): ProbeResult => ({
  id: crypto.randomUUID(),
  classId: demoClass.id,
  childId: id("Arjun"),
  conceptId: "borrowing",
  date: "2026-11-02",
  passedAtOnce,
  restartConceptId: null,
  form: null,
  ...outcome,
});
const withProbe = (p: ProbeResult): ClassData => ({ ...demoData(), probes: [p] });

describe("probeSteps", () => {
  it("asks the failed concept in numbers, then steps down from the root, one prerequisite at a time", () => {
    expect(probeSteps("borrowing", "borrowing")).toEqual([
      { conceptId: "borrowing", form: "abstract" },
      { conceptId: "borrowing", form: "pictorial" },
      { conceptId: "borrowing", form: "concrete" },
      { conceptId: "subtraction-within-20", form: "abstract" },
      { conceptId: "subtraction-within-20", form: "pictorial" },
      { conceptId: "subtraction-within-20", form: "concrete" },
      { conceptId: "numbers-to-20", form: "abstract" },
      { conceptId: "numbers-to-20", form: "pictorial" },
      { conceptId: "numbers-to-20", form: "concrete" },
    ]);
  });

  it("starts at the root when it is below the failed concept", () => {
    expect(probeSteps("two-digit-subtraction", "borrowing").slice(0, 2)).toEqual([
      { conceptId: "two-digit-subtraction", form: "abstract" },
      { conceptId: "borrowing", form: "abstract" },
    ]);
  });
});

describe("probeState", () => {
  const steps = probeSteps("borrowing", "borrowing");

  it("clears a child who passes the first step", () => {
    expect(probeState(steps, [true])).toEqual({ outcome: { passedAtOnce: true, restartConceptId: null, form: null } });
  });

  it("stops at the first ✓, which is the restart point", () => {
    expect(probeState(steps, [false])).toEqual({ next: { conceptId: "borrowing", form: "pictorial" } });
    expect(probeState(steps, [false, false, true])).toEqual({
      outcome: { passedAtOnce: false, restartConceptId: "borrowing", form: "concrete" },
    });
  });

  it("restarts with real objects on the first concept when every step fails", () => {
    expect(probeState(steps, steps.map(() => false))).toEqual({
      outcome: { passedAtOnce: false, restartConceptId: "numbers-to-20", form: "concrete" },
    });
  });
});

describe("groupTime on the demo class", () => {
  it("puts Arjun in the probe group for borrowing, with his root at borrowing", () => {
    const { probe: probeGroup, reteach } = groupTime(demoData());
    const borrowing = probeGroup.find((g) => g.conceptId === "borrowing");
    expect(names(borrowing)).toContain("Arjun");
    expect(borrowing!.records.find((r) => r.child.name === "Arjun")!.root("borrowing")).toBe("borrowing");
    expect(reteach.flatMap((g) => names(g))).not.toContain("Arjun");
  });

  it("moves Arjun to the reteaching group at his restart point after a failed probe", () => {
    const { probe: probeGroup, reteach } = groupTime(withProbe(probe(false, { restartConceptId: "borrowing", form: "concrete" })));
    expect(probeGroup.flatMap((g) => names(g))).not.toContain("Arjun");
    expect(names(reteach.find((g) => g.conceptId === "borrowing"))).toEqual(["Arjun"]);
  });

  it("sends a child who passed the probe at once back to the class", () => {
    const { probe: probeGroup, reteach } = groupTime(withProbe(probe(true)));
    expect([...probeGroup, ...reteach].flatMap((g) => names(g))).not.toContain("Arjun");
  });

  it("suggests the children who follow both languages as buddies", () => {
    expect(groupTime(demoData()).buddies.map((c) => c.name)).toEqual(["Kavita", "Mahesh", "Ramesh"]);
  });
});

describe("kitLanguage", () => {
  const reteach = (data: ClassData) => groupTime(data).reteach.find((g) => g.conceptId === "borrowing")!.records;
  const failed = withProbe(probe(false, { restartConceptId: "borrowing", form: "concrete" }));

  it("speaks Bhili to a group whose profile says home", () => {
    expect(reteach(failed).map((r) => r.language.reteachIn)).toEqual(["home"]);
    expect(kitLanguage(reteach(failed))).toBe("bhili");
  });

  it("switches to Hindi once the listening check shows Arjun follows Hindi well", () => {
    const heard: ListeningResult[] = failed.listening.map((l) =>
      l.childId === id("Arjun") && l.language === "hindi" ? { ...l, status: "right" } : l,
    );
    const records = reteach({ ...failed, listening: heard });
    expect(records.map((r) => r.language.reteachIn)).toEqual(["school"]);
    expect(kitLanguage(records)).toBe("hindi");
  });
});
