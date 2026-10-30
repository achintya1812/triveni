import { z } from "zod";
import { Language, ProbeForm } from "./content";

// What the app stores. The database uses snake_case; the API converts at the boundary.
// IDs are made on the phone, because Dexie writes first and the API second.
// Fields added for the full build have defaults, so records written before them still parse.

// Postgres returns timestamps with an offset (+00:00).
const timestamp = z.iso.datetime({ offset: true });

export const Version = z.enum(["A", "B", "C"]);
export type Version = z.infer<typeof Version>;

export const Status = z.enum(["right", "wrong", "no_data"]);

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
  // Set when a parent starts the Telegram bot from the child's QR code (Stage 22).
  parentChatId: z.string().nullable().default(null),
  parentOptInAt: timestamp.nullable().default(null),
  // The teacher's own view of how well the child follows Hindi; seeds the language profile.
  hindiUnderstanding: z.enum(["well", "some", "none"]).nullable().default(null),
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
  source: z.enum(["dropdown", "voice"]).default("dropdown"),
  transcript: z.string().nullable().default(null),
  page: z.number().int().positive().nullable().default(null),
});
export type Lesson = z.infer<typeof Lesson>;

// Row n on the slate asks questionIds[n - 1]; the concept comes from the question.
// A re-check lists the children it covers; a weekly check (childIds null) covers the whole class.
export const Check = z.object({
  id: z.uuid(),
  classId: z.uuid(),
  date: z.iso.date(),
  questionIds: z.array(z.string()).min(1).max(2),
  kind: z.enum(["weekly", "recheck"]),
  versionOrder: z
    .array(Version)
    .length(3)
    .refine((order) => new Set(order).size === 3, "versionOrder must use A, B and C once each"),
  childIds: z.array(z.uuid()).nullable(),
});
export type Check = z.infer<typeof Check>;

// `value` is null for a blank box, which is marked no_data, and for a box the teacher marked by tap.
export const Answer = z.object({
  checkId: z.uuid(),
  childId: z.uuid(),
  questionId: z.string(),
  row: z.number().int().min(1).max(2),
  version: Version,
  value: z.number().int().nullable(),
  status: Status,
  // The id of the matched wrong answer in the question's list, if any.
  cause: z.string().nullable(),
  // Claude's confidence (0 to 1) for a box read from a slate photo; null when the teacher typed it.
  confidence: z.number().min(0).max(1).nullable(),
  // False only for a photo read the teacher hasn't checked.
  reviewed: z.boolean(),
});
export type Answer = z.infer<typeof Answer>;

// The step-down probe for one child who failed a concept: where they can restart, and in what form.
export const ProbeResult = z.object({
  id: z.uuid(),
  classId: z.uuid(),
  childId: z.uuid(),
  conceptId: z.string(),
  date: z.iso.date(),
  passedAtOnce: z.boolean(),
  restartConceptId: z.string().nullable(),
  form: ProbeForm.nullable(),
});
export type ProbeResult = z.infer<typeof ProbeResult>;

// One answer from the one-time listening check.
export const ListeningResult = z.object({
  classId: z.uuid(),
  childId: z.uuid(),
  date: z.iso.date(),
  itemId: z.string(),
  language: Language,
  value: z.number().int().nullable(),
  status: Status,
});
export type ListeningResult = z.infer<typeof ListeningResult>;

// A voice note sent to a parent on Telegram. Bots get no delivery or read receipts.
export const ParentMessage = z.object({
  id: z.uuid(),
  classId: z.uuid(),
  childId: z.uuid(),
  kind: z.enum(["catch_up", "activity"]),
  conceptId: z.string(),
  file: z.string(),
  status: z.enum(["queued", "sent", "failed"]),
  telegramMessageId: z.number().int().nullable(),
  sentAt: timestamp.nullable(),
});
export type ParentMessage = z.infer<typeof ParentMessage>;
