import { questions } from "@triveni/content";
import type { AudioClip, Child } from "@triveni/core";
import { describe, expect, it } from "vitest";
import { clipProblem } from "./audio";
import { applySlates, isFlagged, markGrid, rollFlags } from "./check";

const question = questions.find((q) => q.id === "q-borrowing")!; // A 9, B 8, C 6
const child = (id: string, homeLanguage: Child["homeLanguage"]): Child => ({
  id,
  classId: "class",
  rollNo: 1,
  name: id,
  homeLanguage,
  parentChatId: null,
  parentOptInAt: null,
  hindiUnderstanding: null,
});

describe("markGrid", () => {
  it("marks right, wrong and blank boxes", () => {
    const answers = markGrid("check", question, [child("ravi", "bhili")], { ravi: { A: "9", B: "21" } });
    expect(answers.map((a) => [a.version, a.value, a.status])).toEqual([
      ["A", 9, "right"],
      ["B", 21, "wrong"],
      ["C", null, "no_data"],
    ]);
  });

  it("gives Hindi-home children no C answer", () => {
    const answers = markGrid("check", question, [child("pooja", "hindi")], { pooja: { A: "9", B: "8", C: "6" } });
    expect(answers.map((a) => a.version)).toEqual(["A", "B"]);
  });

  it("stores a child with no entries as all no_data", () => {
    const answers = markGrid("check", question, [child("meena", "bhili")], {});
    expect(answers.every((a) => a.value === null && a.status === "no_data")).toBe(true);
  });

  it("stores the row it is given", () => {
    const answers = markGrid("check", question, [child("ravi", "bhili")], { ravi: { A: "9" } }, {}, 2);
    expect(answers.every((a) => a.row === 2)).toBe(true);
  });

  it("keeps the confidence of boxes read from photos; typed boxes count as reviewed", () => {
    const reads = { ravi: { A: { confidence: 0.5, reviewed: false } } };
    const answers = markGrid("check", question, [child("ravi", "bhili")], { ravi: { A: "9", B: "8" } }, reads);
    expect(answers.map((a) => [a.version, a.confidence, a.reviewed])).toEqual([
      ["A", 0.5, false],
      ["B", null, true],
      ["C", null, true],
    ]);
  });
});

describe("reading slate photos", () => {
  const roster = [
    { ...child("ravi", "bhili"), rollNo: 1 },
    { ...child("meena", "bhili"), rollNo: 2 },
    { ...child("pooja", "hindi"), rollNo: 3 },
  ];
  const empty = () => ({ values: {}, reads: {} });
  const box = (version: "A" | "B" | "C", value: number | null, confidence = 0.95, row = 1) => ({
    row,
    version,
    value,
    confidence,
  });

  it("fills each child's boxes by roll number, one grid per row", () => {
    const reading = {
      slates: [
        { roll: 1, answers: [box("A", 9), box("B", 21, 0.6), box("C", null), box("A", 5, 0.95, 2)] },
        { roll: 3, answers: [box("A", 9), box("B", 8), box("C", 6)] },
      ],
    };
    const [row1, row2] = applySlates(roster, [empty(), empty()], reading);
    expect(row1.values).toEqual({ ravi: { A: "9", B: "21", C: "" }, pooja: { A: "9", B: "8" } });
    expect(row2.values).toEqual({ ravi: { A: "5" } });
    expect(isFlagged(row1.reads.ravi.B)).toBe(true);
    expect(isFlagged(row1.reads.ravi.A)).toBe(false);
  });

  it("ignores rows beyond the check's, and keeps earlier reads of other children", () => {
    const first = applySlates(roster, [empty()], { slates: [{ roll: 1, answers: [box("A", 9)] }] });
    const second = applySlates(roster, first, { slates: [{ roll: 2, answers: [box("A", 8), box("A", 4, 0.9, 2)] }] });
    expect(second).toHaveLength(1);
    expect(second[0].values).toEqual({ ravi: { A: "9" }, meena: { A: "8" } });
  });

  it("flags rolls that are missing, on two slates, not in the class, or unreadable", () => {
    expect(rollFlags(roster, [1, 1, 7, null])).toEqual({
      unreadable: 1,
      unknown: [7],
      duplicate: [roster[0]],
      missing: [roster[1], roster[2]],
    });
  });

  it("flags no missing rolls before any photo is read", () => {
    expect(rollFlags(roster, []).missing).toEqual([]);
  });

  it("stops flagging a box once the teacher has reviewed it", () => {
    expect(isFlagged({ confidence: 0.5, reviewed: true })).toBe(false);
  });
});

describe("clipProblem", () => {
  const clip = (source: AudioClip["source"], file?: string): AudioClip => ({
    id: "check-b-borrowing",
    kind: "check_b",
    language: "hindi",
    source,
    file,
  });

  it("plays clips with a file, human or generated", () => {
    expect(clipProblem(clip("human", "b.mp3"))).toBeUndefined();
    expect(clipProblem(clip("bulbul", "b.mp3"))).toBeUndefined();
  });

  it("blocks clips with no file", () => {
    expect(clipProblem(clip("human"))).toMatch(/not been made/);
  });
});
