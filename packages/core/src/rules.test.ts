import { describe, expect, it } from "vitest";
import { buildBrief } from "./brief";
import type { Keyword, Question } from "./content";
import { type AttendanceLog, type LessonLog, type Mark, markAnswer, patternGroup, placeChild, wasTaught } from "./rules";

const question: Question = {
  id: "q-borrowing",
  conceptId: "borrowing",
  keywordIds: ["bache"],
  A: { prompt: "14 − 5 = ?", answer: 9 },
  B: { hindi: "…", english: "…", answer: 8, audio: "check-b-borrowing" },
  C: { scriptHi: "…", bhili: "…", english: "…", answer: 6 },
};

const lessons: LessonLog[] = [
  { date: "2026-10-22", conceptId: "borrowing" },
  { date: "2026-10-23", conceptId: "borrowing" },
  { date: "2026-10-21", conceptId: "subtraction-within-20" },
];

describe("markAnswer", () => {
  it("marks right, wrong and blank", () => {
    expect(markAnswer(9, 9)).toBe("right");
    expect(markAnswer(11, 9)).toBe("wrong");
    expect(markAnswer(null, 9)).toBe("no_data");
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
    [w, r, r, "unclear"],
    [r, r, w, "unclear"],
    [w, w, r, "unclear"],
    [w, r, w, "unclear"],
  ] as const)("Bhili child A=%s B=%s C=%s → %s", (a, b, c, group) => {
    expect(patternGroup(a, b, c)).toBe(group);
  });

  it.each([
    [r, r, "ready"],
    [r, w, "word_problem_gap"],
    [w, w, "concept_gap"],
    [w, r, "unclear"],
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
  const meenaAbsent: AttendanceLog[] = [
    { date: "2026-10-22", childId: "meena", present: false },
    { date: "2026-10-23", childId: "meena", present: false },
  ];

  it("splits a concept gap by attendance", () => {
    const meena = { childId: "meena", homeLanguage: "bhili" as const, a: 11, b: 9, c: 7 };
    expect(placeChild(meena, question, lessons, meenaAbsent)).toBe("never_taught");
    expect(placeChild(meena, question, lessons, [])).toBe("taught_not_learned");
  });

  it("places a language gap", () => {
    const ravi = { childId: "ravi", homeLanguage: "bhili" as const, a: 9, b: 23, c: 6 };
    expect(placeChild(ravi, question, lessons, [])).toBe("language_gap");
  });

  it("ignores C for a child whose home language is Hindi", () => {
    const asha = { childId: "asha", homeLanguage: "hindi" as const, a: 9, b: 23, c: null };
    expect(placeChild(asha, question, lessons, [])).toBe("word_problem_gap");
  });
});

describe("buildBrief", () => {
  const bache: Keyword = { id: "bache", hindi: "बचे", roman: "bache", meaning: "left over", bhili: "…" };

  it("lists non-empty groups in a fixed order", () => {
    const brief = buildBrief({
      conceptName: "Borrowing",
      keywords: [bache],
      children: [
        { name: "Asha", placement: "ready" },
        { name: "Ravi", placement: "language_gap" },
        { name: "Meena", placement: "never_taught" },
        { name: "Arjun", placement: "taught_not_learned" },
        { name: "Kiran", placement: "ready" },
      ],
    });
    expect(brief).toMatchInlineSnapshot(`
      "Check on Borrowing: 5 children.
      - Language gap (1): Ravi. Teach the Hindi words bache (बचे, "left over") first, with the Bhili audio.
      - Never taught (absent) (1): Meena. Recap the lesson on Borrowing.
      - Taught but not learned (1): Arjun. Play the Bhili reteaching clip and use real objects.
      - Ready (2): Asha, Kiran. Move on."
    `);
  });
});
