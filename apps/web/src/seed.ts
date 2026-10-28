import type { Child, ClassRecord, Language, Lesson } from "@triveni/core";
import { saveClass, saveDay } from "./db";

// The demo class: 20 children and two school weeks (12–23 October 2026) of attendance and lessons.
// Stage 6 relies on two of them:
// - Ravi (Bhili) is present every day.
// - Meena (Bhili) is absent on both days borrowing was taught (22 and 23 October).
// IDs are fixed, so loading the demo again overwrites the same rows instead of adding a class.

const demoId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const demoClass: ClassRecord = { id: demoId(0), school: "Demo Government Primary School", grade: 2 };

const names: [string, Language][] = [
  ["Ravi", "bhili"],
  ["Meena", "bhili"],
  ["Sunil", "bhili"],
  ["Kavita", "bhili"],
  ["Arjun", "bhili"],
  ["Pooja", "hindi"],
  ["Mahesh", "bhili"],
  ["Rekha", "bhili"],
  ["Dinesh", "bhili"],
  ["Sita", "bhili"],
  ["Ramesh", "bhili"],
  ["Anita", "hindi"],
  ["Gopal", "bhili"],
  ["Lalita", "bhili"],
  ["Vikram", "bhili"],
  ["Sangeeta", "bhili"],
  ["Mukesh", "bhili"],
  ["Radha", "bhili"],
  ["Naresh", "hindi"],
  ["Jyoti", "bhili"],
];

export const demoChildren: Child[] = names.map(([name, homeLanguage], i) => ({
  id: demoId(i + 1),
  classId: demoClass.id,
  rollNo: i + 1,
  name,
  homeLanguage,
}));

const days: [date: string, conceptId: string, absent: string[]][] = [
  ["2026-10-12", "numbers-to-20", ["Sunil"]],
  ["2026-10-13", "numbers-to-20", []],
  ["2026-10-14", "subtraction-within-20", ["Rekha", "Gopal"]],
  ["2026-10-15", "subtraction-within-20", ["Gopal"]],
  ["2026-10-16", "subtraction-within-20", []],
  ["2026-10-19", "subtraction-within-20", ["Jyoti"]],
  ["2026-10-20", "subtraction-within-20", []],
  ["2026-10-21", "subtraction-within-20", ["Mukesh"]],
  ["2026-10-22", "borrowing", ["Meena", "Vikram"]],
  ["2026-10-23", "borrowing", ["Meena", "Sangeeta"]],
];

export const demoDays: { date: string; absentChildIds: string[]; lesson: Lesson }[] = days.map(
  ([date, conceptId, absent], i) => ({
    date,
    absentChildIds: absent.map((name) => demoChildren.find((c) => c.name === name)!.id),
    lesson: { id: demoId(101 + i), classId: demoClass.id, date, conceptId },
  }),
);

// Keeps going when the API fails, so the whole demo still lands in Dexie; then reports the first error.
export async function loadDemo() {
  let firstError: unknown;
  const attempt = (save: Promise<void>) => save.catch((e) => (firstError ??= e));
  await attempt(saveClass(demoClass, demoChildren));
  for (const day of demoDays) {
    await attempt(saveDay(demoClass.id, day.date, day.absentChildIds, day.lesson));
  }
  if (firstError) throw firstError;
}
