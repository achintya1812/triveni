import { questions } from "@triveni/content";
import { type AudioClip, type Child, placeSlate, type Slate } from "@triveni/core";
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
    { ...child("ravi", "bhili"), rollNo: 1, name: "Ravi" },
    { ...child("meena", "bhili"), rollNo: 2, name: "Meena" },
    { ...child("pooja", "hindi"), rollNo: 3, name: "Pooja" },
  ];
  const empty = () => ({ values: {}, reads: {} });
  const box = (version: "A" | "B" | "C", value: number | null, confidence = 0.95, row = 1) => ({
    row,
    version,
    value,
    confidence,
  });
  const slate = (roll: number | null, answers = [box("A", 9)], extra: Partial<Slate> = {}): Slate => ({
    rollAsWritten: roll === null ? null : String(roll),
    roll,
    rollConfidence: 0.95,
    name: null,
    answers,
    ...extra,
  });

  it("fills each child's boxes by roll number, one grid per row", () => {
    const reading = {
      slates: [
        slate(1, [box("A", 9), box("B", 21, 0.6), box("C", null), box("A", 5, 0.95, 2)]),
        slate(3, [box("A", 9), box("B", 8), box("C", 6)]),
      ],
    };
    const { grids, placed } = applySlates(roster, [empty(), empty()], reading, 1);
    expect(grids[0].values).toEqual({ ravi: { A: "9", B: "21", C: "" }, pooja: { A: "9", B: "8" } });
    expect(grids[1].values).toEqual({ ravi: { A: "5" } });
    expect(isFlagged(grids[0].reads.ravi.B)).toBe(true);
    expect(isFlagged(grids[0].reads.ravi.A)).toBe(false);
    expect(placed.map((c) => c.rollNo)).toEqual([1, 3]);
  });

  it("ignores rows beyond the check's, and keeps earlier reads of other children", () => {
    const first = applySlates(roster, [empty()], { slates: [slate(1, [box("A", 9)])] }, 1).grids;
    const second = applySlates(roster, first, { slates: [slate(2, [box("A", 8), box("A", 4, 0.9, 2)])] }, 2).grids;
    expect(second).toHaveLength(1);
    expect(second[0].values).toEqual({ ravi: { A: "9" }, meena: { A: "8" } });
  });

  it("places a slate with only a name by the name, in any case", () => {
    expect(placeSlate(roster, slate(null, [], { name: "meena" }))?.name).toBe("Meena");
  });

  it("places a slate by name when the roll is unsure, and by roll when the name matches no one", () => {
    expect(placeSlate(roster, slate(1, [], { rollConfidence: 0.5, name: "Ravi" }))?.name).toBe("Ravi");
    expect(placeSlate(roster, slate(9, [], { rollConfidence: 0.5, name: "Meena" }))?.name).toBe("Meena");
    expect(placeSlate(roster, slate(2, [], { name: "मीना" }))?.name).toBe("Meena");
  });

  it("leaves a slate unplaced when the roll is unsure, not in the class, or disagrees with the name", () => {
    const reading = {
      slates: [
        slate(1, [box("A", 9)], { rollAsWritten: "१?", rollConfidence: 0.5 }), // unsure, no name
        slate(7), // not in the class
        slate(null), // no roll, no name
        slate(1, [box("A", 4)], { name: "Meena" }), // roll 1 is Ravi: a misread roll, or the wrong slate
      ],
    };
    const { grids, placed, unplaced } = applySlates(roster, [empty()], reading, 2);
    expect(placed).toEqual([]);
    expect(grids[0].values).toEqual({});
    expect(unplaced.map((u) => [u.photo, u.slate, u.rollAsWritten, u.name])).toEqual([
      [2, 1, "१?", null],
      [2, 2, "7", null],
      [2, 3, null, null],
      [2, 4, "1", "Meena"],
    ]);
  });

  it("doesn't place by a name two children share", () => {
    const twins = [...roster, { ...child("ravi-2", "bhili"), rollNo: 4, name: "Ravi" }];
    expect(placeSlate(twins, slate(null, [], { name: "Ravi" }))).toBeUndefined();
  });

  it("flags rolls that are missing or on two slates", () => {
    expect(rollFlags(roster, [1, 1])).toEqual({ duplicate: [roster[0]], missing: [roster[1], roster[2]] });
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
