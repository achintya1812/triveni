import { questions } from "@triveni/content";
import type { Attendance } from "@triveni/core";
import { describe, expect, it } from "vitest";
import { type GridValues, markGrid } from "./check";
import { placeChildren } from "./results";
import { demoChildren, demoDays } from "./seed";

// The Stage 6 check: a borrowing check on the demo class (A 9, B 8, C 6).
const question = questions.find((q) => q.conceptId === "borrowing")!;
const lessons = demoDays.map((d) => d.lesson);
const attendance: Attendance[] = demoDays.flatMap((d) =>
  demoChildren.map((c) => ({ classId: c.classId, date: d.date, childId: c.id, present: !d.absentChildIds.includes(c.id) })),
);
const id = (name: string) => demoChildren.find((c) => c.name === name)!.id;

describe("placeChildren on the demo class", () => {
  const values: GridValues = {
    [id("Ravi")]: { A: "9", B: "21", C: "6" }, // right, wrong, right
    [id("Meena")]: { A: "7", B: "21", C: "11" }, // all wrong, absent both borrowing days
    [id("Sunil")]: { A: "7", B: "21", C: "11" }, // all wrong, present
    [id("Kavita")]: { A: "9", B: "8", C: "6" },
    [id("Pooja")]: { A: "9", B: "21" }, // Hindi at home: no C
  };
  const children = demoChildren.filter((c) => c.id in values);
  const placed = placeChildren(question, children, markGrid("check", question, children, values), lessons, attendance, "2026-10-30");
  const placement = (name: string) => placed.find((p) => p.child.name === name)?.placement;

  it("puts Ravi in Language gap", () => expect(placement("Ravi")).toBe("language_gap"));
  it("puts Meena in Never taught", () => expect(placement("Meena")).toBe("never_taught"));
  it("puts a present child who got all three wrong in Taught but not learned", () =>
    expect(placement("Sunil")).toBe("taught_not_learned"));
  it("puts a child with all three right in Ready", () => expect(placement("Kavita")).toBe("ready"));
  it("treats A right, B wrong as a word-problem gap for a Hindi-home child", () =>
    expect(placement("Pooja")).toBe("word_problem_gap"));

  it("leaves out children with no answers in the check", () => {
    expect(placeChildren(question, demoChildren, [], lessons, attendance, "2026-10-30")).toEqual([]);
  });
});
