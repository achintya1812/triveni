import { afterAll, describe, expect, it } from "vitest";
import { app } from "./app";
import { db } from "./db";

const send = (method: string, path: string, body: unknown) =>
  app.request(path, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const get = async (path: string) => (await app.request(path)).json();

describe("bad input", () => {
  it("rejects an unknown home language", async () => {
    const child = { id: crypto.randomUUID(), rollNo: 1, name: "Asha", homeLanguage: "french" };
    const res = await send("POST", `/classes/${crypto.randomUUID()}/children`, [child]);
    expect(res.status).toBe(400);
  });

  it("rejects a date that is not YYYY-MM-DD", async () => {
    const res = await send("PUT", `/classes/${crypto.randomUUID()}/attendance/27-10-2026`, { absentChildIds: [] });
    expect(res.status).toBe(400);
  });
});

// Needs apps/api/.env with Supabase keys; skipped without them (as in CI).
describe.skipIf(!process.env.SUPABASE_URL)("round trip through Supabase", () => {
  const classId = crypto.randomUUID();
  const checkId = crypto.randomUUID();
  const date = "2026-10-20";
  const klass = { id: classId, school: "Test school", grade: 2 };
  const ravi = { id: crypto.randomUUID(), classId, rollNo: 1, name: "Ravi", homeLanguage: "bhili" };
  const meena = { id: crypto.randomUUID(), classId, rollNo: 2, name: "Meena", homeLanguage: "hindi" };
  const lesson = { id: crypto.randomUUID(), classId, date, conceptId: "borrowing" };
  const check = { id: checkId, classId, date: "2026-10-23", conceptId: "borrowing" };
  const answers = [
    { checkId, childId: ravi.id, questionId: "q-borrowing", version: "A", value: 9, status: "right" },
    { checkId, childId: ravi.id, questionId: "q-borrowing", version: "B", value: 21, status: "wrong" },
    { checkId, childId: ravi.id, questionId: "q-borrowing", version: "C", value: null, status: "no_data" },
  ];
  const byChild = (a: { childId: string }, b: { childId: string }) => a.childId.localeCompare(b.childId);

  afterAll(async () => {
    await db().from("classes").delete().eq("id", classId);
  });

  it("class", async () => {
    expect((await send("POST", "/classes", klass)).status).toBe(201);
    expect(await get(`/classes/${classId}`)).toEqual(klass);
  });

  it("children", async () => {
    const body = [ravi, meena].map(({ classId: _, ...child }) => child);
    expect((await send("POST", `/classes/${classId}/children`, body)).status).toBe(201);
    expect(await get(`/classes/${classId}/children`)).toEqual([ravi, meena]);
  });

  it("attendance", async () => {
    expect((await send("PUT", `/classes/${classId}/attendance/${date}`, { absentChildIds: [meena.id] })).status).toBe(200);
    const rows = await get(`/classes/${classId}/attendance`);
    expect(rows.sort(byChild)).toEqual(
      [
        { classId, date, childId: ravi.id, present: true },
        { classId, date, childId: meena.id, present: false },
      ].sort(byChild),
    );
  });

  it("lesson", async () => {
    const { classId: _, ...body } = lesson;
    expect((await send("POST", `/classes/${classId}/lessons`, body)).status).toBe(201);
    expect(await get(`/classes/${classId}/lessons`)).toEqual([lesson]);
  });

  it("deleting a lesson", async () => {
    expect((await app.request(`/classes/${classId}/lessons/${lesson.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await get(`/classes/${classId}/lessons`)).toEqual([]);
  });

  it("check and answers", async () => {
    const { classId: _, ...checkBody } = check;
    expect((await send("POST", `/classes/${classId}/checks`, checkBody)).status).toBe(201);
    const answerBody = answers.map(({ checkId: _, ...answer }) => answer);
    expect((await send("POST", `/checks/${checkId}/answers`, answerBody)).status).toBe(201);
    expect(await get(`/checks/${checkId}/answers`)).toEqual(answers);
  });
});
