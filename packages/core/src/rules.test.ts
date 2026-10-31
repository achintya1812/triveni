import { describe, expect, it } from "vitest";
import type { Concept, Question } from "./content";
import {
  type AttendanceLog,
  isoWeek,
  labelFor,
  type LessonLog,
  type Mark,
  markAnswer,
  needsRecheck,
  patternGroup,
  pickConcepts,
  type PlacementLog,
  placeChild,
  type ProbeLog,
  versionOrder,
  wasTaught,
} from "./rules";

const question: Question = {
  id: "q-borrowing",
  conceptId: "borrowing",
  keywordIds: ["bache"],
  A: { prompt: "14 − 5 = ?", answer: 9 },
  B: { hindi: "…", english: "Ravi had 15 mangoes and gave away 7. How many are left?", answer: 8, audio: "check-b-borrowing" },
  C: { scriptHi: "…", bhili: "…", english: "Ravi had 13 mangoes and gave away 7. How many are left?", answer: 6 },
  use: "weekly",
  wrongAnswers: {
    A: [{ value: 11, cause: "borrowing", meaning: "Took the smaller digit from the larger", pointsTo: "concept", conceptId: "borrowing" }],
    B: [
      { value: 22, cause: "added", meaning: "Added instead of subtracted", pointsTo: "keyword" },
      { value: 157, cause: "joined", meaning: "Wrote the numbers side by side", pointsTo: "no_data" },
    ],
    C: [],
  },
};

const lessons: LessonLog[] = [
  { date: "2026-10-22", conceptId: "borrowing" },
  { date: "2026-10-23", conceptId: "borrowing" },
  { date: "2026-10-21", conceptId: "subtraction-within-20" },
];

describe("markAnswer", () => {
  it("marks right, wrong and blank", () => {
    expect(markAnswer(9, question, "A")).toEqual({ status: "right", cause: null });
    expect(markAnswer(12, question, "A")).toEqual({ status: "wrong", cause: null });
    expect(markAnswer(null, question, "A")).toEqual({ status: "no_data", cause: null });
  });

  it("gives a listed wrong answer its cause", () => {
    expect(markAnswer(11, question, "A")).toEqual({ status: "wrong", cause: "borrowing" });
    expect(markAnswer(22, question, "B")).toEqual({ status: "wrong", cause: "added" });
  });

  it("counts a listed answer that points to no data as no data", () => {
    expect(markAnswer(157, question, "B")).toEqual({ status: "no_data", cause: "joined" });
  });

  it("counts a number copied from that version's question as no data", () => {
    expect(markAnswer(14, question, "A")).toEqual({ status: "no_data", cause: "copied" });
    expect(markAnswer(15, question, "B")).toEqual({ status: "no_data", cause: "copied" });
    expect(markAnswer(13, question, "C")).toEqual({ status: "no_data", cause: "copied" });
  });

  it("only treats a number as copied from the version's own question", () => {
    expect(markAnswer(13, question, "B")).toEqual({ status: "wrong", cause: null });
  });
});

describe("patternGroup", () => {
  const r: Mark = "right";
  const w: Mark = "wrong";

  it.each([
    [r, r, r, "ready"],
    [w, w, w, "concept_gap"],
    [r, w, r, "language_gap"],
    [r, w, w, "word_problem_gap"],
    [w, r, r, "symbol_gap"],
    [r, r, w, "clip_failed"],
    [w, w, r, "language_symbol_gap"],
    [w, r, w, "inconsistent"],
  ] as const)("Bhili child A=%s B=%s C=%s → %s", (a, b, c, group) => {
    expect(patternGroup(a, b, c)).toBe(group);
  });

  it.each([
    [r, r, "ready"],
    [r, w, "word_problem_gap"],
    [w, w, "concept_gap"],
    [w, r, "symbol_gap"],
  ] as const)("Hindi child A=%s B=%s → %s", (a, b, group) => {
    expect(patternGroup(a, b, null)).toBe(group);
  });

  it("treats any blank as unclear", () => {
    expect(patternGroup("no_data", w, w)).toBe("unclear");
    expect(patternGroup(r, "no_data", r)).toBe("unclear");
    expect(patternGroup(r, r, "no_data")).toBe("unclear");
    expect(patternGroup(w, "no_data", null)).toBe("unclear");
  });
});

describe("wasTaught", () => {
  const absent = (childId: string, ...dates: string[]): AttendanceLog[] =>
    dates.map((date) => ({ date, childId, present: false }));

  it("is false when absent on every day the concept was taught", () => {
    expect(wasTaught("meena", "borrowing", lessons, absent("meena", "2026-10-22", "2026-10-23"))).toBe(false);
  });

  it("is true when present on at least one of those days", () => {
    expect(wasTaught("meena", "borrowing", lessons, absent("meena", "2026-10-22"))).toBe(true);
  });

  it("ignores absences on other concepts' days and other children's absences", () => {
    expect(wasTaught("meena", "borrowing", lessons, absent("meena", "2026-10-21"))).toBe(true);
    expect(wasTaught("meena", "borrowing", lessons, absent("ravi", "2026-10-22", "2026-10-23"))).toBe(true);
  });

  it("counts a child with no attendance rows as present", () => {
    expect(wasTaught("meena", "borrowing", lessons, [])).toBe(true);
  });

  it("counts the child as taught when no lesson was logged", () => {
    expect(wasTaught("meena", "numbers-to-20", lessons, absent("meena", "2026-10-22"))).toBe(true);
  });
});

describe("placeChild", () => {
  const checkDay = "2026-10-30";
  const meenaAbsent: AttendanceLog[] = [
    { date: "2026-10-22", childId: "meena", present: false },
    { date: "2026-10-23", childId: "meena", present: false },
  ];

  it("splits a concept gap by attendance", () => {
    const meena = { childId: "meena", homeLanguage: "bhili" as const, a: 11, b: 9, c: 5 };
    expect(placeChild(meena, question, lessons, meenaAbsent, checkDay)).toBe("never_taught");
    expect(placeChild(meena, question, lessons, [], checkDay)).toBe("taught_not_learned");
  });

  it("places a language gap", () => {
    const ravi = { childId: "ravi", homeLanguage: "bhili" as const, a: 9, b: 23, c: 6 };
    expect(placeChild(ravi, question, lessons, [], checkDay)).toBe("language_gap");
  });

  it("ignores C for a child whose home language is Hindi", () => {
    const asha = { childId: "asha", homeLanguage: "hindi" as const, a: 9, b: 23, c: null };
    expect(placeChild(asha, question, lessons, [], checkDay)).toBe("word_problem_gap");
  });

  it("makes a copied number unclear, not wrong", () => {
    const kiran = { childId: "kiran", homeLanguage: "bhili" as const, a: 9, b: 15, c: 6 };
    expect(placeChild(kiran, question, lessons, [], checkDay)).toBe("unclear");
  });

  describe("a child absent on the check day", () => {
    const absentToday = (childId: string): AttendanceLog => ({ date: checkDay, childId, present: false });
    const blank = (childId: string) => ({ childId, homeLanguage: "bhili" as const, a: null, b: null, c: null });

    it("is never taught if they also missed the lesson", () => {
      expect(placeChild(blank("meena"), question, lessons, [...meenaAbsent, absentToday("meena")], checkDay)).toBe(
        "never_taught",
      );
    });

    it("is not checked yet if they were taught", () => {
      expect(placeChild(blank("ravi"), question, lessons, [absentToday("ravi")], checkDay)).toBe("not_checked");
    });
  });
});

describe("labelFor", () => {
  const log = (date: string, placement: PlacementLog["placement"], conceptId = "borrowing"): PlacementLog => ({
    childId: "ravi",
    conceptId,
    date,
    placement,
  });
  const probe = (date: string, passedAtOnce: boolean): ProbeLog => ({ childId: "ravi", conceptId: "borrowing", date, passedAtOnce });

  it("has no label without a result", () => {
    expect(labelFor("ravi", "borrowing", [], [])).toBeNull();
  });

  it("leaves a pattern seen once unconfirmed, and puts it on the re-check list", () => {
    const label = labelFor("ravi", "borrowing", [log("2026-10-30", "word_problem_gap")], []);
    expect(label).toEqual({ placement: "word_problem_gap", confirmed: false });
    expect(needsRecheck(label)).toBe(true);
  });

  it("confirms the same pattern on the next result (a re-check the next day)", () => {
    const label = labelFor("ravi", "borrowing", [log("2026-10-30", "word_problem_gap"), log("2026-10-31", "word_problem_gap")], []);
    expect(label).toEqual({ placement: "word_problem_gap", confirmed: true });
    expect(needsRecheck(label)).toBe(false);
  });

  it("goes by the latest result when the pattern changes", () => {
    const placements = [log("2026-10-30", "word_problem_gap"), log("2026-10-31", "ready")];
    expect(labelFor("ravi", "borrowing", placements, [])).toEqual({ placement: "ready", confirmed: true });
  });

  it("confirms a language gap seen in another week, on another concept", () => {
    const placements = [log("2026-10-23", "language_gap", "subtraction-within-20"), log("2026-10-30", "language_gap")];
    expect(labelFor("ravi", "borrowing", placements, [])).toEqual({ placement: "language_gap", confirmed: true });
  });

  it("doesn't confirm a language gap seen twice in the same week on different concepts", () => {
    const placements = [log("2026-10-29", "language_gap", "subtraction-within-20"), log("2026-10-30", "language_gap")];
    expect(labelFor("ravi", "borrowing", placements, [])?.confirmed).toBe(false);
  });

  it("confirms taught-but-not-learned with a probe the child didn't pass at once", () => {
    const placements = [log("2026-10-30", "taught_not_learned")];
    expect(labelFor("ravi", "borrowing", placements, [])).toEqual({ placement: "taught_not_learned", confirmed: false });
    expect(needsRecheck(labelFor("ravi", "borrowing", placements, []))).toBe(false); // the probe is its second look
    expect(labelFor("ravi", "borrowing", placements, [probe("2026-10-31", false)])?.confirmed).toBe(true);
  });

  it("clears the label when the child passes the probe at once", () => {
    expect(labelFor("ravi", "borrowing", [log("2026-10-30", "taught_not_learned")], [probe("2026-10-31", true)])).toBeNull();
  });

  it("ignores a probe from before the latest result", () => {
    const placements = [log("2026-10-30", "taught_not_learned")];
    expect(labelFor("ravi", "borrowing", placements, [probe("2026-10-20", true)])).toEqual({
      placement: "taught_not_learned",
      confirmed: false,
    });
  });

  it("needs no second look for ready or never taught", () => {
    expect(labelFor("ravi", "borrowing", [log("2026-10-30", "never_taught")], [])).toEqual({ placement: "never_taught", confirmed: true });
  });

  it("never makes a group of inconsistent, unclear or not checked", () => {
    for (const placement of ["inconsistent", "unclear", "not_checked"] as const) {
      const label = labelFor("ravi", "borrowing", [log("2026-10-29", placement), log("2026-10-30", placement)], []);
      expect(label).toEqual({ placement, confirmed: false });
      expect(needsRecheck(label)).toBe(false);
    }
  });
});

describe("versionOrder", () => {
  it("rotates the order each ISO week", () => {
    const weeks = ["2026-10-19", "2026-10-26", "2026-11-02"].map(versionOrder);
    expect(new Set(weeks.map((o) => o.join(""))).size).toBe(3);
    for (const order of weeks) expect([...order].sort()).toEqual(["A", "B", "C"]);
  });

  it("keeps the same order all week", () => {
    expect(versionOrder("2026-10-26")).toEqual(versionOrder("2026-11-01")); // Monday and Sunday
  });

  it("numbers weeks the ISO way", () => {
    expect(isoWeek("2026-10-30")).toBe("2026-W44");
    expect(isoWeek("2027-01-01")).toBe("2026-W53"); // a Friday, in the last week of 2026
  });
});

describe("pickConcepts", () => {
  const concept = (id: string, prerequisites: string[]): Concept => ({
    id,
    name: id,
    prerequisites,
    pages: [],
    reteach: { english: "", bhili: "" },
    probe: [],
  });
  const chain = [
    concept("numbers-to-20", []),
    concept("subtraction-within-20", ["numbers-to-20"]),
    concept("borrowing", ["subtraction-within-20"]),
    concept("two-digit-subtraction", ["borrowing"]),
  ];
  const taught: LessonLog[] = [
    { date: "2026-10-26", conceptId: "two-digit-subtraction" },
    { date: "2026-10-27", conceptId: "subtraction-within-20" },
    { date: "2026-10-28", conceptId: "borrowing" },
    { date: "2026-10-29", conceptId: "borrowing" },
  ];

  it("picks at most two, those most others depend on first", () => {
    expect(pickConcepts(taught, chain, null)).toEqual(["subtraction-within-20", "borrowing"]);
  });

  it("only counts lessons after the last weekly check", () => {
    expect(pickConcepts(taught, chain, "2026-10-27")).toEqual(["borrowing"]);
  });

  it("breaks a tie by the most recent lesson", () => {
    const flat = [concept("x", []), concept("y", [])];
    const lessons = [
      { date: "2026-10-26", conceptId: "x" },
      { date: "2026-10-28", conceptId: "y" },
    ];
    expect(pickConcepts(lessons, flat, null)).toEqual(["y", "x"]);
  });
});
