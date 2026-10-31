import { questions } from "@triveni/content";
import type { Answer, Check } from "@triveni/core";
import { describe, expect, it } from "vitest";
import { type Grid, markGrid } from "./check";
import { placedOnRow } from "./results";
import { demoCheck, demoChildren, demoData } from "./seed";

// This week's live check on the demo class (2 November 2026): borrowing (14 − 5 = 9, B 8, C 6) and
// subtraction within 20 (17 − 4 = 13, B 15, C 11).
const live: Check = { ...demoCheck, id: "00000000-0000-4000-8000-000000000301", date: "2026-11-02", questionIds: ["q-borrowing", "q-subtraction-within-20"] };
const id = (name: string) => demoChildren.find((c) => c.name === name)!.id;
const borrowing: Grid["values"] = {
  [id("Ravi")]: { A: "9", B: "22", C: "6" }, // a language gap again, in a new week
  [id("Meena")]: { A: "11", B: "9", C: "4" }, // still never taught
  [id("Sita")]: { A: "9", B: "22", C: "4" },
  [id("Kavita")]: { A: "9", B: "8", C: "6" },
  [id("Pooja")]: { A: "9", B: "15" }, // copied 15 from the question
};
const children = demoChildren.filter((c) => c.id in borrowing);
const answers: Answer[] = [
  ...markGrid(live.id, questions.find((q) => q.id === "q-borrowing")!, children, borrowing, {}, 1),
  ...markGrid(live.id, questions.find((q) => q.id === "q-subtraction-within-20")!, children, {}, {}, 2),
];
const data = demoData();
const withLive = { ...data, checks: [...data.checks, live], answers: [...data.answers, ...answers] };
const placed = placedOnRow(withLive, live, 1);
const of = (name: string) => placed.find((p) => p.child.name === name)!;

describe("placedOnRow on the demo class, after this week's live check", () => {
  it("puts Ravi in a confirmed language gap", () => {
    expect(of("Ravi")).toMatchObject({ placement: "language_gap", pending: null });
  });

  it("puts Meena in Never taught", () => {
    expect(of("Meena").placement).toBe("never_taught");
  });

  it("confirms Sita's word-problem gap, seen in last week's check too", () => {
    expect(of("Sita")).toMatchObject({ placement: "word_problem_gap", pending: null });
  });

  it("explains a copied number", () => {
    expect(of("Pooja")).toMatchObject({ placement: "unclear", notes: [{ version: "B", value: 15, cause: "copied" }] });
  });

  it("only places the children on that row", () => {
    expect(placed.map((p) => p.child.name).sort()).toEqual(["Kavita", "Meena", "Pooja", "Ravi", "Sita"]);
    expect(placedOnRow(withLive, live, 2)).toHaveLength(5); // all blank: unclear
  });

  it("marks a pattern seen once as waiting for a re-check, and a concept gap as waiting for the probe", () => {
    const lastWeek = placedOnRow(data, demoCheck, 2);
    const p = (name: string) => lastWeek.find((x) => x.child.name === name)!;
    expect(p("Sita").pending).toBe("recheck");
    expect(p("Arjun")).toMatchObject({ placement: "taught_not_learned", pending: "probe" });
  });
});
