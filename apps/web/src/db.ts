import type {
  Answer,
  Attendance,
  Check,
  Child,
  ClassRecord,
  Lesson,
  ListeningResult,
  ParentMessage,
  ProbeResult,
} from "@triveni/core";
import { Dexie, type EntityTable, type Table } from "dexie";
import type { GridReads, GridValues } from "./check";

// The check in progress, so it survives switching screens (Stage 14 shapes it).
export type Draft = {
  classId: string;
  checkId: string;
  questionIds: string[];
  values: GridValues;
  reads: GridReads;
};

// Mirrors the API's tables. Every write goes here first, then to the API.
// There is no outbox yet (Stage 17): if the API call fails, the caller shows an error.
// A new database name, because Dexie can't change a table's primary key (answers gained `row`),
// and the full build has no MVP data to keep.
export const db = new Dexie("triveni-full") as Dexie & {
  classes: EntityTable<ClassRecord, "id">;
  children: EntityTable<Child, "id">;
  attendance: Table<Attendance, [string, string]>;
  lessons: EntityTable<Lesson, "id">;
  checks: EntityTable<Check, "id">;
  answers: Table<Answer, [string, string, number, string]>;
  probeResults: EntityTable<ProbeResult, "id">;
  listeningResults: Table<ListeningResult, [string, string, string]>;
  parentMessages: EntityTable<ParentMessage, "id">;
  drafts: EntityTable<Draft, "classId">;
};

db.version(1).stores({
  classes: "id",
  children: "id, classId",
  attendance: "[childId+date], classId, date",
  lessons: "id, classId, date",
  checks: "id, classId",
  answers: "[checkId+childId+row+version], checkId",
  probeResults: "id, classId, childId",
  listeningResults: "[childId+itemId+language], classId",
  parentMessages: "id, classId, childId",
  drafts: "classId",
});

export async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Server said ${res.status} for ${method} ${path}`);
  return res;
}

export async function saveClass(klass: ClassRecord, children: Child[]) {
  await db.transaction("rw", db.classes, db.children, async () => {
    await db.classes.put(klass);
    await db.children.bulkPut(children);
  });
  await api("POST", "/classes", klass);
  await api("POST", `/classes/${klass.id}/children`, children);
}

// Everyone not listed as absent is present. `lesson` is left out on days with no logged concept,
// which also deletes any lesson saved earlier for that day.
export async function saveDay(classId: string, date: string, absentChildIds: string[], lesson?: Lesson) {
  const children = await db.children.where({ classId }).toArray();
  const rows = children.map((c) => ({ classId, date, childId: c.id, present: !absentChildIds.includes(c.id) }));
  const cleared = lesson ? [] : await db.lessons.where({ date }).and((l) => l.classId === classId).toArray();
  await db.transaction("rw", db.attendance, db.lessons, async () => {
    await db.attendance.bulkPut(rows);
    if (lesson) await db.lessons.put(lesson);
    await db.lessons.bulkDelete(cleared.map((l) => l.id));
  });
  await api("PUT", `/classes/${classId}/attendance/${date}`, { absentChildIds });
  if (lesson) await api("POST", `/classes/${classId}/lessons`, lesson);
  for (const l of cleared) await api("DELETE", `/classes/${classId}/lessons/${l.id}`);
}

// Saving again with the same check id overwrites the earlier answers.
export async function saveCheck(check: Check, answers: Answer[]) {
  await db.transaction("rw", db.checks, db.answers, async () => {
    await db.checks.put(check);
    await db.answers.bulkPut(answers);
  });
  await api("POST", `/classes/${check.classId}/checks`, check);
  await api("POST", `/checks/${check.id}/answers`, answers);
}

// The listening check's results, saved once for the class.
export async function saveListening(classId: string, results: ListeningResult[]) {
  await db.listeningResults.bulkPut(results);
  await api("POST", `/classes/${classId}/listening`, results);
}
