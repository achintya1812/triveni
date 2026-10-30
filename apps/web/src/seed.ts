import { concepts, questions } from "@triveni/content";
import {
  type Answer,
  type Attendance,
  type Check,
  type Child,
  type ClassData,
  type ClassRecord,
  type Language,
  type Lesson,
  type ListeningResult,
  markAnswer,
  type Version,
  versionOrder,
} from "@triveni/core";
import { saveCheck, saveClass, saveDay, saveListening } from "./db";

// The demo class: 20 children, three school weeks (12–30 October 2026) of attendance and lessons,
// last week's check (23 October), and a listening check. The demo then runs this week's check live.
// Planted children (TODO.md, Stage 12):
// - Ravi (Bhili, present every day): a language gap on last week's check. This week's check confirms it.
// - Meena: absent both days borrowing was taught (21 and 22 October), so never taught; absent again on
//   29 October, so the morning brief says she is back.
// - Arjun: present, but wrote 11 for 14 − 5, a borrowing mistake: taught but not learned.
// - Sita: a word-problem gap seen once, for a live re-check to confirm.
// - The other patterns are spread across the class; Kavita, Mahesh and Ramesh follow both languages (buddies).
// IDs are fixed, so loading the demo again overwrites the same rows instead of adding a class.

const demoId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const demoClass: ClassRecord = { id: demoId(0), school: "Demo Government Primary School", grade: 2 };

const names: [string, Language, Child["hindiUnderstanding"]][] = [
  ["Ravi", "bhili", "none"],
  ["Meena", "bhili", null],
  ["Sunil", "bhili", "some"],
  ["Kavita", "bhili", "well"],
  ["Arjun", "bhili", null],
  ["Pooja", "hindi", "well"],
  ["Mahesh", "bhili", null],
  ["Rekha", "bhili", null],
  ["Dinesh", "bhili", null],
  ["Sita", "bhili", null],
  ["Ramesh", "bhili", null],
  ["Anita", "hindi", "well"],
  ["Gopal", "bhili", null],
  ["Lalita", "bhili", null],
  ["Vikram", "bhili", null],
  ["Sangeeta", "bhili", null],
  ["Mukesh", "bhili", null],
  ["Radha", "bhili", null],
  ["Naresh", "hindi", "well"],
  ["Jyoti", "bhili", null],
];

export const demoChildren: Child[] = names.map(([name, homeLanguage, hindiUnderstanding], i) => ({
  id: demoId(i + 1),
  classId: demoClass.id,
  rollNo: i + 1,
  name,
  homeLanguage,
  parentChatId: null,
  parentOptInAt: null,
  hindiUnderstanding,
}));
const byName = (name: string) => demoChildren.find((c) => c.name === name)!;

// Date, concept and textbook page (NCERT Joyful Mathematics, Class 2; resources/TEXTBOOKS.md), absent children.
// 23 October is check day, with no lesson. Lessons on concepts not in the content yet are left out,
// so two-digit subtraction appears once Stage 19 adds it.
const days: [date: string, conceptId: string | null, page: number | null, absent: string[]][] = [
  ["2026-10-12", "numbers-to-20", 22, ["Sunil"]],
  ["2026-10-13", "numbers-to-20", 25, []],
  ["2026-10-14", "subtraction-within-20", 59, ["Rekha", "Gopal"]],
  ["2026-10-15", "subtraction-within-20", 59, ["Gopal"]],
  ["2026-10-16", "subtraction-within-20", 59, []],
  ["2026-10-19", "subtraction-within-20", 59, ["Jyoti"]],
  ["2026-10-20", "subtraction-within-20", 59, []],
  ["2026-10-21", "borrowing", 65, ["Meena", "Vikram"]],
  ["2026-10-22", "borrowing", 64, ["Meena", "Sangeeta"]],
  ["2026-10-23", null, null, ["Jyoti"]],
  ["2026-10-26", "two-digit-subtraction", 61, ["Mukesh"]],
  ["2026-10-27", "two-digit-subtraction", 62, []],
  ["2026-10-28", "two-digit-subtraction", 63, ["Radha"]],
  ["2026-10-29", "two-digit-subtraction", 67, ["Meena"]],
  ["2026-10-30", "two-digit-subtraction", 68, []],
];

export const demoDays: { date: string; absentChildIds: string[]; lesson?: Lesson }[] = days.map(
  ([date, conceptId, page, absent], i) => {
    const known = conceptId && concepts.some((c) => c.id === conceptId);
    // The borrowing lesson on 21 October was logged by voice note.
    const voice = date === "2026-10-21";
    return {
      date,
      absentChildIds: absent.map((name) => byName(name).id),
      lesson: known
        ? {
            id: demoId(101 + i),
            classId: demoClass.id,
            date,
            conceptId,
            source: voice ? "voice" : "dropdown",
            transcript: voice ? "आज उधार लेकर घटाना पढ़ाया, पेज 65" : null,
            page,
          }
        : undefined,
    };
  },
);

// Last week's check: subtraction within 20 (row 1: 17 − 4, B 15, C 11) and borrowing (row 2: 14 − 5, B 8, C 6).
const checkDate = "2026-10-23";
const rows = [
  questions.find((q) => q.id === "q-subtraction-within-20")!,
  questions.find((q) => q.id === "q-borrowing")!,
];
export const demoCheck: Check = {
  id: demoId(201),
  classId: demoClass.id,
  date: checkDate,
  questionIds: rows.map((q) => q.id),
  kind: "weekly",
  versionOrder: versionOrder(checkDate),
  childIds: null,
};

// Each child's A, B, C on each row; everyone else got every box right. Wrong values avoid the numbers in
// the question, which would count as copied. Jyoti was absent, so she has no answers.
const planted: Record<string, [(number | null)[]?, (number | null)[]?]> = {
  Ravi: [[13, 21, 11], [9, 22, 6]], // language gap on both rows (B added instead of subtracted)
  Meena: [undefined, [11, 9, 4]], // all wrong, absent when borrowing was taught: never taught
  Arjun: [undefined, [11, 9, 8]], // all wrong, present: taught but not learned (11 is the borrowing mistake)
  Sita: [undefined, [9, 22, 4]], // word-problem gap, seen once
  Sunil: [undefined, [10, 8, 6]], // symbol gap
  Rekha: [undefined, [9, 8, 10]], // Bhili clip not followed
  Dinesh: [undefined, [10, 9, 6]], // language and symbol gap
  Gopal: [undefined, [10, 8, 9]], // inconsistent
  Lalita: [undefined, [9, 8, null]], // a blank box: unclear
  Anita: [undefined, [9, 6]], // Hindi at home: A right, B wrong is a word-problem gap
};

export const demoAnswers: Answer[] = demoChildren
  .filter((c) => c.name !== "Jyoti")
  .flatMap((child) =>
    rows.flatMap((question, i) => {
      const versions: Version[] = child.homeLanguage === "hindi" ? ["A", "B"] : ["A", "B", "C"];
      const values = planted[child.name]?.[i] ?? versions.map((v) => question[v].answer);
      return versions.map((version, j) => ({
        checkId: demoCheck.id,
        childId: child.id,
        questionId: question.id,
        row: i + 1,
        version,
        value: values[j] ?? null,
        ...markAnswer(values[j] ?? null, question, version),
        confidence: null,
        reviewed: true,
      }));
    }),
  );

// The one-time listening check (16 October): four items in each language, marked by tap.
// Item ids match the listening items Stage 19 writes. Right answers per child, out of 4:
const heard: Record<string, [hindi: number, bhili: number]> = {
  Ravi: [1, 4],
  Kavita: [4, 4],
  Mahesh: [4, 4],
  Ramesh: [4, 4],
  Pooja: [4, 1],
  Anita: [4, 2],
  Naresh: [4, 1],
};
export const demoListening: ListeningResult[] = demoChildren.flatMap((child) => {
  const [hindi, bhili] = heard[child.name] ?? [2, 4];
  return [1, 2, 3, 4].flatMap((n) =>
    (["hindi", "bhili"] as const).map((language) => ({
      classId: demoClass.id,
      childId: child.id,
      date: "2026-10-16",
      itemId: `l-${n}`,
      language,
      value: null,
      status: n <= (language === "hindi" ? hindi : bhili) ? ("right" as const) : ("wrong" as const),
    })),
  );
});

// The demo as the rules engine sees it.
export function demoData(): ClassData {
  const attendance: Attendance[] = demoDays.flatMap((d) =>
    demoChildren.map((c) => ({ classId: demoClass.id, date: d.date, childId: c.id, present: !d.absentChildIds.includes(c.id) })),
  );
  return {
    children: demoChildren,
    checks: [demoCheck],
    answers: demoAnswers,
    lessons: demoDays.flatMap((d) => (d.lesson ? [d.lesson] : [])),
    attendance,
    probes: [],
    listening: demoListening,
  };
}

// Keeps going when the API fails, so the whole demo still lands in Dexie; then reports the first error.
export async function loadDemo() {
  let firstError: unknown;
  const attempt = (save: Promise<void>) => save.catch((e) => (firstError ??= e));
  await attempt(saveClass(demoClass, demoChildren));
  for (const day of demoDays) {
    await attempt(saveDay(demoClass.id, day.date, day.absentChildIds, day.lesson));
  }
  await attempt(saveCheck(demoCheck, demoAnswers));
  await attempt(saveListening(demoClass.id, demoListening));
  if (firstError) throw firstError;
}
