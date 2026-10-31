import { describe, expect, it } from "vitest";
import { buildDailyBrief } from "./brief";
import type { Concept, Keyword, Question, WrongAnswer } from "./content";
import type { Answer, Attendance, Check, Child, Lesson, ListeningResult, ProbeResult, Version } from "./records";
import { buddies, type ClassData, type Content, childRecord } from "./running";

// A small class over two weekly checks (23 and 30 October 2026, in different ISO weeks):
// - Ravi: a language gap on both checks, with the "gave away / left" words in the second.
// - Meena: absent both days borrowing was taught, then fails two-digit subtraction.
// - Arjun: present for everything, but writes 11 for 14 − 5 (a borrowing mistake).
// - Sita: a word-problem gap, seen once.
// - Kavita: ready, and strong in both languages (a buddy).
// - Pooja: Hindi at home, ready.

const concept = (id: string, name: string, nameHi: string, prerequisites: string[]): Concept => ({
  id,
  name,
  nameHi,
  prerequisites,
  pages: [],
  reteach: { english: "", bhili: "" },
  catchUp: { english: "", hindi: "", bhili: "" },
  probe: [],
});
const concepts = [
  concept("numbers-to-20", "Numbers to 20", "20 तक की संख्याएँ", []),
  concept("subtraction-within-20", "Subtraction within 20", "20 तक घटाना", ["numbers-to-20"]),
  concept("borrowing", "Borrowing", "उधार लेकर घटाना", ["subtraction-within-20"]),
  concept("two-digit-subtraction", "Two-digit subtraction", "दो अंकों का घटाना", ["borrowing"]),
];

const keyword = (id: string, hindi: string, meaning: string): Keyword => ({ id, hindi, roman: id.replace("-", " "), meaning, bhili: "…" });
const keywords = [
  keyword("ud-gayin", "उड़ गईं", "flew away"),
  keyword("ab-kitni", "अब कितनी", "how many now"),
  keyword("de-diye", "दे दिए", "gave away"),
  keyword("bache", "बचे", "left over"),
];

const question = (
  id: string,
  conceptId: string,
  keywordIds: string[],
  answers: [number, number, number],
  wrongAnswers: Partial<Record<Version, WrongAnswer[]>> = {},
): Question => ({
  id,
  conceptId,
  keywordIds,
  A: { prompt: "…", answer: answers[0] },
  B: { hindi: "…", english: "…", answer: answers[1], audio: "…" },
  C: { scriptHi: "…", bhili: "…", english: "…", answer: answers[2] },
  use: "weekly",
  wrongAnswers: { A: [], B: [], C: [], ...wrongAnswers },
});
const added: WrongAnswer = { value: 22, cause: "added", meaning: "Added instead of subtracted", pointsTo: "keyword" };
const borrowingMistake = (value: number): WrongAnswer => ({
  value,
  cause: "borrowing",
  meaning: "Took the smaller digit from the larger",
  pointsTo: "concept",
  conceptId: "borrowing",
});
const questions = [
  question("q-sub", "subtraction-within-20", ["ud-gayin", "ab-kitni"], [13, 15, 11]),
  question("q-borrow", "borrowing", ["de-diye", "bache"], [9, 8, 6], { A: [borrowingMistake(11)], B: [added] }),
  question("q-two-digit", "two-digit-subtraction", ["bache"], [28, 26, 25], { A: [borrowingMistake(32)] }),
];
const content: Content = { concepts, questions, keywords };

const classId = "00000000-0000-4000-8000-000000000000";
const child = (n: number, name: string, homeLanguage: Child["homeLanguage"], hindiUnderstanding: Child["hindiUnderstanding"] = null): Child => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  classId,
  rollNo: n,
  name,
  homeLanguage,
  parentChatId: null,
  parentOptInAt: null,
  hindiUnderstanding,
});
const [ravi, meena, arjun, sita, kavita, pooja] = [
  child(1, "Ravi", "bhili"),
  child(2, "Meena", "bhili"),
  child(3, "Arjun", "bhili"),
  child(4, "Sita", "bhili"),
  child(5, "Kavita", "bhili", "well"),
  child(6, "Pooja", "hindi"),
];
const children = [ravi, meena, arjun, sita, kavita, pooja];

const lesson = (date: string, conceptId: string): Lesson => ({ id: `${date}-${conceptId}`, classId, date, conceptId, source: "dropdown", transcript: null, page: null });
const lessons = [
  lesson("2026-10-19", "subtraction-within-20"),
  lesson("2026-10-20", "subtraction-within-20"),
  lesson("2026-10-26", "borrowing"),
  lesson("2026-10-27", "borrowing"),
  lesson("2026-10-28", "two-digit-subtraction"),
  lesson("2026-10-29", "two-digit-subtraction"),
];
// Everyone present, except Meena on both borrowing days and the day before the latest one.
const absences: Record<string, string[]> = { "2026-10-26": [meena.id], "2026-10-27": [meena.id], "2026-10-29": [meena.id] };
const days = ["2026-10-19", "2026-10-20", "2026-10-23", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"];
const attendance: Attendance[] = days.flatMap((date) =>
  children.map((c) => ({ classId, date, childId: c.id, present: !absences[date]?.includes(c.id) })),
);

const check = (id: string, date: string, questionIds: string[]): Check => ({
  id,
  classId,
  date,
  questionIds,
  kind: "weekly",
  versionOrder: ["A", "B", "C"],
  childIds: null,
});
const week1 = check("00000000-0000-4000-8000-0000000000a1", "2026-10-23", ["q-sub"]);
const week2 = check("00000000-0000-4000-8000-0000000000a2", "2026-10-30", ["q-borrow", "q-two-digit"]);

// One child's answers on one row: values in A, B, C order (C left out for Hindi-home children).
function row(c: Child, chk: Check, rowNo: number, values: (number | null)[]): Answer[] {
  const q = questions.find((x) => x.id === chk.questionIds[rowNo - 1])!;
  return (["A", "B", "C"] as const).slice(0, values.length).map((version, i) => {
    const value = values[i];
    const listed = q.wrongAnswers[version].find((w) => w.value === value);
    const status = value === null ? "no_data" : value === q[version].answer ? "right" : "wrong";
    return { checkId: chk.id, childId: c.id, questionId: q.id, row: rowNo, version, value, status, cause: listed?.cause ?? null, confidence: null, reviewed: true };
  });
}
const answers: Answer[] = [
  ...row(ravi, week1, 1, [13, 20, 11]), // language gap
  ...row(meena, week1, 1, [13, 15, 11]),
  ...row(arjun, week1, 1, [13, 15, 11]),
  ...row(sita, week1, 1, [13, 15, 11]),
  ...row(kavita, week1, 1, [13, 15, 11]),
  ...row(pooja, week1, 1, [13, 15]),
  ...row(ravi, week2, 1, [9, 22, 6]), // language gap, "added" (points to a key word)
  ...row(ravi, week2, 2, [28, 26, 25]),
  ...row(meena, week2, 1, [5, 7, 4]), // never taught
  ...row(meena, week2, 2, [20, 30, 21]), // taught but not learned
  ...row(arjun, week2, 1, [11, 7, 4]), // taught but not learned, borrowing mistake
  ...row(arjun, week2, 2, [32, 30, 21]),
  ...row(sita, week2, 1, [9, 7, 5]), // word-problem gap, seen once
  ...row(sita, week2, 2, [28, 26, 25]),
  ...row(kavita, week2, 1, [9, 8, 6]),
  ...row(kavita, week2, 2, [28, 26, 25]),
  ...row(pooja, week2, 1, [9, 8]),
  ...row(pooja, week2, 2, [28, 26]),
];

const listen = (c: Child, language: ListeningResult["language"], status: ListeningResult["status"]): ListeningResult => ({
  classId,
  childId: c.id,
  date: "2026-10-16",
  itemId: "l-goat",
  language,
  value: null,
  status,
});
const listening = [listen(ravi, "hindi", "wrong"), listen(ravi, "bhili", "right"), listen(kavita, "hindi", "right"), listen(kavita, "bhili", "right")];

const data: ClassData = { children, checks: [week1, week2], answers, lessons, attendance, probes: [], listening };
const record = (c: Child, d = data) => childRecord(c, d, content);

describe("concept status and root", () => {
  it("roots Meena's two-digit gap in borrowing, which she was never taught", () => {
    const r = record(meena);
    expect(r.concepts["borrowing"].status).toBe("not_taught");
    expect(r.concepts["two-digit-subtraction"].status).toBe("taught_not_learned");
    expect(r.root("two-digit-subtraction")).toBe("borrowing");
  });

  it("roots Arjun's gaps in borrowing from his wrong answers, though he was present", () => {
    const r = record(arjun);
    expect(r.concepts["borrowing"]).toMatchObject({ status: "taught_not_learned", causes: ["borrowing"] });
    expect(r.root("borrowing")).toBe("borrowing");
    expect(r.root("two-digit-subtraction")).toBe("borrowing");
  });

  it("falls back to the concept itself when nothing points earlier", () => {
    expect(record(kavita).root("borrowing")).toBe("borrowing");
  });

  it("counts a concept as learned once a probe is passed at once", () => {
    const probe: ProbeResult = { id: "p", classId, childId: arjun.id, conceptId: "borrowing", date: "2026-10-31", passedAtOnce: true, restartConceptId: null, form: null };
    const r = record(arjun, { ...data, probes: [probe] });
    expect(r.concepts["borrowing"]).toMatchObject({ status: "learned", label: null });
  });
});

describe("labels", () => {
  it("confirms Ravi's language gaps from two different weeks without a re-check", () => {
    expect(record(ravi).concepts["borrowing"].label).toEqual({ placement: "language_gap", confirmed: true });
  });

  it("leaves Sita's word-problem gap unconfirmed after one check", () => {
    expect(record(sita).concepts["borrowing"].label).toEqual({ placement: "word_problem_gap", confirmed: false });
  });
});

describe("word evidence", () => {
  it("ranks the words Ravi stumbles on, counting a direction-word mistake double", () => {
    const { words } = record(ravi);
    expect(words).toEqual({
      "ud-gayin": { met: 1, stumbled: 1 },
      "ab-kitni": { met: 1, stumbled: 1 },
      "de-diye": { met: 1, stumbled: 2 },
      bache: { met: 2, stumbled: 2 },
    });
    const top = Object.entries(words).sort((x, y) => y[1].stumbled - x[1].stumbled).slice(0, 2).map(([id]) => id);
    expect(top.sort()).toEqual(["bache", "de-diye"]);
  });
});

describe("language profile", () => {
  it("reteaches Ravi in Bhili first: he follows Bhili far better", () => {
    expect(record(ravi).language).toEqual({ hindi: 0.25, bhili: 1, reteachIn: "home" });
  });

  it("reteaches a child who follows Hindi well in Hindi", () => {
    expect(record(kavita).language.reteachIn).toBe("school");
  });

  it("always reteaches a Hindi-home child in Hindi", () => {
    expect(record(pooja).language.reteachIn).toBe("school");
  });

  it("mixes the languages when neither is clearly stronger", () => {
    const some = { ...sita, hindiUnderstanding: "some" as const };
    const d = { ...data, children: data.children.map((c) => (c.id === sita.id ? some : c)) };
    // Sita: Hindi from 3 B results on A-right rows (2 right, 1 wrong) and "some" (0.5); Bhili from 3 C results (2 right).
    expect(record(some, d).language).toEqual({ hindi: 0.625, bhili: 2 / 3, reteachIn: "mixed" });
  });

  it("puts a Bhili-home child with no evidence on Bhili first", () => {
    const d = { ...data, answers: [], listening: [] };
    expect(record(meena, d).language).toEqual({ hindi: null, bhili: null, reteachIn: "home" });
  });
});

describe("buddies", () => {
  it("picks children ready on their latest check who follow both languages well", () => {
    expect(buddies(children.map((c) => record(c))).map((c) => c.name)).toEqual(["Kavita"]);
  });
});

describe("buildDailyBrief", () => {
  it("has all five sections, in IDEA.md's order", () => {
    expect(buildDailyBrief("2026-10-31", data, content, "en")).toMatchInlineSnapshot(`
      "Morning brief, 2026-10-31
      - Meena is back.
      - Meena missed Two-digit subtraction.
      - 1 of 6 missed Borrowing (Meena), and later lessons build on it. Recap it with them in group time, and send catch-up voice notes to their parents.
      - Language group (1): Ravi. Teach the Hindi words de diye (दे दिए, "gave away"), bache (बचे, "left over") and ud gayin (उड़ गईं, "flew away") first, with the Bhili audio.
      - Probe group (2): Meena (start at Borrowing) and Arjun (start at Borrowing). Run the step-down probe in group time.
      - Quick re-check (1): Sita. Seen once; re-check in group time."
    `);
  });

  it("writes the same brief in Hindi", () => {
    expect(buildDailyBrief("2026-10-31", data, content, "hi")).toMatchInlineSnapshot(`
      "सुबह की जानकारी, 2026-10-31
      - फिर से कक्षा में: Meena।
      - Meena की अनुपस्थिति में पढ़ाया गया: दो अंकों का घटाना।
      - 6 में से 1 बच्चे उधार लेकर घटाना के पाठ में अनुपस्थित थे (Meena), और आगे के पाठ इसी पर टिके हैं। समूह-समय में इनके साथ पाठ दोहराएँ, और इनके माता-पिता को कैच-अप वॉइस नोट भेजें।
      - भाषा समूह (1): Ravi। पहले ये हिंदी शब्द सिखाएँ: दे दिए (de diye), बचे (bache) और उड़ गईं (ud gayin), भीली ऑडियो के साथ।
      - जाँच समूह (2): Meena (उधार लेकर घटाना से शुरू करें) और Arjun (उधार लेकर घटाना से शुरू करें)। समूह-समय में क्रमवार जाँच (प्रोब) करें।
      - त्वरित दोबारा जाँच (1): Sita। यह पैटर्न एक बार दिखा है; समूह-समय में फिर से जाँचें।"
    `);
  });

  it("moves a child who failed the probe from the probe group to reteaching, from the probe's restart point", () => {
    const probe: ProbeResult = {
      id: "p",
      classId,
      childId: arjun.id,
      conceptId: "borrowing",
      date: "2026-10-31",
      passedAtOnce: false,
      restartConceptId: "subtraction-within-20",
      form: "concrete",
    };
    const brief = buildDailyBrief("2026-10-31", { ...data, probes: [probe] }, content, "en");
    expect(brief).toContain("Reteaching group (1): Arjun (from Subtraction within 20).");
    expect(brief).toContain("Probe group (2): Meena (start at Borrowing) and Arjun (start at Borrowing).");
  });

  it("says when nothing needs attention", () => {
    const quiet = { ...data, answers: [], attendance: [], checks: [] };
    expect(buildDailyBrief("2026-10-31", { ...quiet, lessons: [] }, content, "en")).toBe(
      "Morning brief, 2026-10-31\nNothing needs attention today.",
    );
  });
});
