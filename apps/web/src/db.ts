import {
  type Answer,
  type Attendance,
  type Check,
  Child,
  type ClassRecord,
  type Lesson,
  type ListeningResult,
  type ParentMessage,
  type ProbeResult,
} from "@triveni/core";
import { Dexie, type EntityTable, type Table } from "dexie";
import type { Grid, UnplacedSlate } from "./check";

// The check in progress, kept so it survives switching screens and reloading.
// `grids` has one grid per row (question); `rolls` is the roll of every slate placed from photos so far;
// `unplaced` holds the slates the teacher still has to give to a child.
export type Draft = {
  classId: string;
  checkId: string;
  date: string;
  questionIds: string[];
  grids: Grid[];
  rolls: number[];
  unplaced: UnplacedSlate[];
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
// Drafts gained `unplaced`, and `rolls` holds only placed slates' rolls.
db.version(2).upgrade((tx) =>
  tx
    .table("drafts")
    .toCollection()
    .modify((d) => {
      d.unplaced ??= [];
      d.rolls = d.rolls.filter((r: number | null) => r !== null);
    }),
);

export async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw Object.assign(new Error(`Server said ${res.status} for ${method} ${path}`), { status: res.status });
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

// The step-down probe's results, one per child.
export async function saveProbes(classId: string, results: ProbeResult[]) {
  await db.probeResults.bulkPut(results);
  for (const result of results) await api("POST", `/classes/${classId}/probes`, result);
}

// A change to one child, such as the teacher's view of how well they follow Hindi.
export async function saveChild(child: Child) {
  await db.children.put(child);
  await api("POST", `/classes/${child.classId}/children`, [child]);
}

// Sends parents a voice note on Telegram: a concept's catch-up lesson, or the kit's home activity.
export type SendResult = {
  messages: ParentMessage[];
  failed: { childId: string; error: string }[];
  notOptedIn: string[];
};
export async function sendToParents(kind: ParentMessage["kind"], conceptId: string, childIds: string[]) {
  const result = (await (await api("POST", "/parents/send", { kind, conceptId, childIds })).json()) as SendResult;
  await db.parentMessages.bulkPut(result.messages);
  return result;
}

// Parents opt in on Telegram, which the server records, so the phone fetches the children again to see it.
export async function refreshChildren(classId: string) {
  const children = Child.array().parse(await (await api("GET", `/classes/${classId}/children`)).json());
  await db.children.bulkPut(children);
}

// Marks one child absent or present on a day, keeping the rest of the day's attendance and its lesson.
export async function setAbsent(classId: string, date: string, childId: string, absent: boolean) {
  const rows = await db.attendance.where({ date }).and((r) => r.classId === classId).toArray();
  const others = rows.filter((r) => !r.present && r.childId !== childId).map((r) => r.childId);
  const lesson = await db.lessons.where({ date }).and((l) => l.classId === classId).first();
  await saveDay(classId, date, absent ? [...others, childId] : others, lesson);
}
