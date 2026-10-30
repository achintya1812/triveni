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

  it("rejects speech with no text", async () => {
    expect((await send("POST", "/speak", { text: "  " })).status).toBe(400);
  });

  it("rejects speech in a language other than Bhili or Hindi", async () => {
    expect((await send("POST", "/speak", { text: "नमस्ते", language: "marathi" })).status).toBe(400);
  });

  it("rejects an empty brief", async () => {
    expect((await send("POST", "/brief/reword", { brief: "" })).status).toBe(400);
  });

  it("rejects a brief language other than English or Hindi", async () => {
    expect((await send("POST", "/brief/reword", { brief: "Hello", language: "fr" })).status).toBe(400);
  });

  it("rejects a slate photo that isn't base64", async () => {
    expect((await send("POST", "/slates/read", { image: "not base64!", mediaType: "image/jpeg" })).status).toBe(400);
  });

  it("rejects a version order that repeats a version", async () => {
    const check = { id: crypto.randomUUID(), date: "2026-10-23", questionIds: ["q-borrowing"], kind: "weekly", versionOrder: ["A", "A", "B"], childIds: null };
    expect((await send("POST", `/classes/${crypto.randomUUID()}/checks`, check)).status).toBe(400);
  });
});

// Needs apps/api/.env with Supabase keys; skipped without them (as in CI).
describe.skipIf(!process.env.SUPABASE_URL)("speech cache", () => {
  const text = `Not spoken yet ${crypto.randomUUID()}`;

  it("says an uncached clip isn't made yet, without making it", async () => {
    expect((await send("POST", "/speak", { text, cachedOnly: true })).status).toBe(404);
  });

  it("answers 503 at once for uncached Bhili when the speech service isn't running", async () => {
    const before = process.env.TTS_URL;
    process.env.TTS_URL = "http://127.0.0.1:9"; // nothing listens here
    try {
      expect((await send("POST", "/speak", { text, language: "bhili" })).status).toBe(503);
    } finally {
      if (before === undefined) delete process.env.TTS_URL;
      else process.env.TTS_URL = before;
    }
  });
});

describe.skipIf(!process.env.SUPABASE_URL)("round trip through Supabase", () => {
  const classId = crypto.randomUUID();
  const checkId = crypto.randomUUID();
  const date = "2026-10-20";
  const klass = { id: classId, school: "Test school", grade: 2 };
  const ravi = {
    id: crypto.randomUUID(),
    classId,
    rollNo: 1,
    name: "Ravi",
    homeLanguage: "bhili",
    parentChatId: "123456789",
    parentOptInAt: "2026-10-21T09:30:00+00:00",
    hindiUnderstanding: "some",
  };
  // Sent without the full-build fields, which default.
  const meena = { id: crypto.randomUUID(), classId, rollNo: 2, name: "Meena", homeLanguage: "hindi" };
  const meenaStored = { ...meena, parentChatId: null, parentOptInAt: null, hindiUnderstanding: null };
  const lesson = { id: crypto.randomUUID(), classId, date, conceptId: "borrowing", source: "voice", transcript: "borrowing, page 34", page: 34 };
  const check = {
    id: checkId,
    classId,
    date: "2026-10-23",
    questionIds: ["q-subtraction-within-20", "q-borrowing"],
    kind: "recheck",
    versionOrder: ["B", "C", "A"],
    childIds: [ravi.id],
  };
  const answers = [
    { checkId, childId: ravi.id, questionId: "q-subtraction-within-20", row: 1, version: "A", value: 13, status: "right", cause: null, confidence: null, reviewed: true },
    { checkId, childId: ravi.id, questionId: "q-borrowing", row: 2, version: "A", value: 9, status: "right", cause: null, confidence: null, reviewed: true },
    { checkId, childId: ravi.id, questionId: "q-borrowing", row: 2, version: "B", value: 21, status: "wrong", cause: "added", confidence: 0.5, reviewed: false },
    { checkId, childId: ravi.id, questionId: "q-borrowing", row: 2, version: "C", value: null, status: "no_data", cause: null, confidence: 0.75, reviewed: true },
  ];
  const probe = { id: crypto.randomUUID(), classId, childId: ravi.id, conceptId: "borrowing", date: "2026-10-24", passedAtOnce: false, restartConceptId: "subtraction-within-20", form: "concrete" };
  const listening = [
    { classId, childId: ravi.id, date: "2026-10-19", itemId: "l-goat", language: "bhili", value: 2, status: "right" },
    { classId, childId: ravi.id, date: "2026-10-19", itemId: "l-goat", language: "hindi", value: null, status: "no_data" },
  ];
  const message = { id: crypto.randomUUID(), classId, childId: ravi.id, kind: "catch_up", conceptId: "borrowing", file: "tg/abc.ogg", status: "sent", telegramMessageId: 4242, sentAt: "2026-10-24T13:00:00+00:00" };
  const omitClass = <T extends { classId: string }>({ classId: _, ...rest }: T) => rest;
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
    expect(await get(`/classes/${classId}/children`)).toEqual([ravi, meenaStored]);
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
    expect((await send("POST", `/classes/${classId}/checks`, omitClass(check))).status).toBe(201);
    expect(await get(`/classes/${classId}/checks`)).toEqual([check]);
    const answerBody = answers.map(({ checkId: _, ...answer }) => answer);
    expect((await send("POST", `/checks/${checkId}/answers`, answerBody)).status).toBe(201);
    const byKey = (a: (typeof answers)[number], b: (typeof answers)[number]) => a.row - b.row || a.version.localeCompare(b.version);
    expect(await get(`/checks/${checkId}/answers`)).toEqual([...answers].sort(byKey));
  });

  it("probe result", async () => {
    expect((await send("POST", `/classes/${classId}/probes`, omitClass(probe))).status).toBe(201);
    expect(await get(`/classes/${classId}/probes`)).toEqual([probe]);
  });

  it("listening results", async () => {
    expect((await send("POST", `/classes/${classId}/listening`, listening.map(omitClass))).status).toBe(201);
    const byLanguage = (a: { language: string }, b: { language: string }) => a.language.localeCompare(b.language);
    expect((await get(`/classes/${classId}/listening`)).sort(byLanguage)).toEqual([...listening].sort(byLanguage));
  });

  it("parent message", async () => {
    expect((await send("POST", `/classes/${classId}/parent-messages`, omitClass(message))).status).toBe(201);
    expect(await get(`/classes/${classId}/parent-messages`)).toEqual([message]);
  });
});
