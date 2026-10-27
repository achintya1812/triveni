import { z } from "zod";
import { Language } from "./content";

// What the app stores. The database uses snake_case; the API converts at the boundary.
// IDs are made on the phone, because Dexie writes first and the API second.

export const ClassRecord = z.object({
  id: z.uuid(),
  school: z.string().min(1),
  grade: z.number().int().positive(),
});
export type ClassRecord = z.infer<typeof ClassRecord>;

export const Child = z.object({
  id: z.uuid(),
  classId: z.uuid(),
  rollNo: z.number().int().positive(),
  name: z.string().min(1),
  homeLanguage: Language,
});
export type Child = z.infer<typeof Child>;

// Must stay assignable to AttendanceLog in rules.ts.
export const Attendance = z.object({
  classId: z.uuid(),
  date: z.iso.date(),
  childId: z.uuid(),
  present: z.boolean(),
});
export type Attendance = z.infer<typeof Attendance>;

// Must stay assignable to LessonLog in rules.ts.
export const Lesson = z.object({
  id: z.uuid(),
  classId: z.uuid(),
  date: z.iso.date(),
  conceptId: z.string(),
});
export type Lesson = z.infer<typeof Lesson>;

// The MVP checks one concept.
export const Check = z.object({
  id: z.uuid(),
  classId: z.uuid(),
  date: z.iso.date(),
  conceptId: z.string(),
});
export type Check = z.infer<typeof Check>;

// `value` is null for a blank box, which is marked no_data.
export const Answer = z.object({
  checkId: z.uuid(),
  childId: z.uuid(),
  questionId: z.string(),
  version: z.enum(["A", "B", "C"]),
  value: z.number().int().nullable(),
  status: z.enum(["right", "wrong", "no_data"]),
});
export type Answer = z.infer<typeof Answer>;
