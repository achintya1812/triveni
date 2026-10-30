import { concepts, keywords, questions } from "@triveni/content";
import { buddies, buildDailyBrief, childRecord, type ClassData, needsRecheck, versionOrder } from "@triveni/core";
import { describe, expect, it } from "vitest";
import { demoAnswers, demoCheck, demoChildren, demoData, demoDays } from "./seed";

const content = { concepts, questions, keywords };
const data = demoData();
const child = (name: string) => demoChildren.find((c) => c.name === name)!;
const record = (name: string, d: ClassData = data) => childRecord(child(name), d, content);

describe("the demo class", () => {
  it("has 20 children, 3 of them Hindi at home, and three school weeks", () => {
    expect(demoChildren).toHaveLength(20);
    expect(demoChildren.filter((c) => c.homeLanguage === "hindi")).toHaveLength(3);
    expect(demoDays.map((d) => d.date)).toEqual(expect.arrayContaining(["2026-10-12", "2026-10-23", "2026-10-30"]));
  });

  it("logs lessons with textbook pages, one of them by voice note", () => {
    const lessons = data.lessons;
    expect(lessons.every((l) => l.page !== null)).toBe(true);
    expect(lessons.filter((l) => l.source === "voice")).toEqual([
      expect.objectContaining({ conceptId: "borrowing", page: 65, transcript: expect.stringContaining("पेज 65") }),
    ]);
  });

  it("asks last week's check in that week's rotated order", () => {
    expect(demoCheck.versionOrder).toEqual(versionOrder("2026-10-23"));
  });
});

describe("the planted children", () => {
  it("Ravi has a language gap, seen once on each concept last week", () => {
    expect(record("Ravi").concepts["subtraction-within-20"].label).toEqual({ placement: "language_gap", confirmed: false });
    expect(record("Ravi").concepts["borrowing"].label).toEqual({ placement: "language_gap", confirmed: false });
  });

  it("this week's live check confirms Ravi's language gap", () => {
    const liveCheck = { ...demoCheck, id: "00000000-0000-4000-8000-000000000999", date: "2026-11-02", questionIds: ["q-borrowing"] };
    const live = demoAnswers
      .filter((a) => a.childId === child("Ravi").id && a.row === 2)
      .map((a) => ({ ...a, checkId: liveCheck.id, row: 1 }));
    const d = { ...data, checks: [...data.checks, liveCheck], answers: [...data.answers, ...live] };
    expect(record("Ravi", d).concepts["borrowing"].label).toEqual({ placement: "language_gap", confirmed: true });
  });

  it("Meena was never taught borrowing", () => {
    const r = record("Meena");
    expect(r.concepts["borrowing"]).toMatchObject({ status: "not_taught", label: { placement: "never_taught" } });
  });

  it("Arjun was taught borrowing but didn't learn it, and wrote 11", () => {
    const r = record("Arjun");
    expect(r.concepts["borrowing"].label?.placement).toBe("taught_not_learned");
    expect(demoAnswers.find((a) => a.childId === child("Arjun").id && a.row === 2 && a.version === "A")?.value).toBe(11);
  });

  it("Sita has a word-problem gap seen once, so she's on the re-check list", () => {
    const label = record("Sita").concepts["borrowing"].label;
    expect(label).toEqual({ placement: "word_problem_gap", confirmed: false });
    expect(needsRecheck(label)).toBe(true);
  });

  it("spreads the other patterns across the class", () => {
    const placements = demoChildren.map((c) => record(c.name).concepts["borrowing"].label?.placement);
    for (const p of ["symbol_gap", "clip_failed", "language_symbol_gap", "inconsistent", "unclear", "not_checked", "ready"]) {
      expect(placements).toContain(p);
    }
  });

  it("has three bilingual buddies", () => {
    expect(buddies(demoChildren.map((c) => record(c.name))).map((c) => c.name)).toEqual(["Kavita", "Mahesh", "Ramesh"]);
  });

  it("gives a morning brief that starts with Meena coming back", () => {
    // Until Stage 19 adds two-digit subtraction, nothing builds on borrowing, so add it for this brief.
    const twoDigit = { ...concepts.find((c) => c.id === "borrowing")!, id: "two-digit-subtraction", prerequisites: ["borrowing"] };
    const withTwoDigit = concepts.some((c) => c.id === twoDigit.id) ? concepts : [...concepts, twoDigit];
    const brief = buildDailyBrief("2026-10-31", data, { ...content, concepts: withTwoDigit }, "en");
    expect(brief).toContain("Meena is back.");
    expect(brief).toMatch(/1 of 20 missed Borrowing.* \(Meena\), and later lessons build on it/);
    expect(brief).toMatch(/Probe group \(\d+\): .*Arjun/);
    expect(brief).toMatch(/Quick re-check \(\d+\): .*Sita/);
  });
});
