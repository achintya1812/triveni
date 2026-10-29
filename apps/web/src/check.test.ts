import { questions } from "@triveni/content";
import type { AudioClip, Child } from "@triveni/core";
import { describe, expect, it } from "vitest";
import { clipProblem } from "./audio";
import { markGrid } from "./check";

const question = questions.find((q) => q.id === "q-borrowing")!; // A 9, B 8, C 6
const child = (id: string, homeLanguage: Child["homeLanguage"]): Child => ({
  id,
  classId: "class",
  rollNo: 1,
  name: id,
  homeLanguage,
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
});

describe("clipProblem", () => {
  const clip = (source: AudioClip["source"], file?: string): AudioClip => ({
    id: "check-b-borrowing",
    kind: "check_b",
    language: "hindi",
    source,
    file,
  });

  it("plays human recordings", () => {
    expect(clipProblem(clip("human", "b.mp3"), false)).toBeUndefined();
  });

  it("blocks stand-ins unless the dev flag is on", () => {
    expect(clipProblem(clip("bulbul", "b.mp3"), false)).toMatch(/stand-in/);
    expect(clipProblem(clip("bulbul", "b.mp3"), true)).toBeUndefined();
  });

  it("blocks clips with no file, even with the flag on", () => {
    expect(clipProblem(clip("human"), true)).toMatch(/not been recorded/);
  });
});
