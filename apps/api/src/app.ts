import { createHash } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { Answer, Attendance, Check, Child, ClassRecord, Lesson } from "@triveni/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import { z } from "zod";
import { rewordBrief } from "./brief";
import { db } from "./db";
import { readSlates } from "./slates";

// No auth in the MVP: one teacher and one demo class.
// Writes are upserts, so the phone can safely send the same record again.

const snake = (o: object) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`), v]));
const camel = (o: object) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_([a-z])/g, (_, m: string) => m.toUpperCase()), v]));

function json<T extends z.ZodType>(schema: T) {
  return validator("json", (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    return parsed.data as z.output<T>;
  });
}

// Supabase returns errors rather than throwing them; throw so onError can pick a status.
async function run(query: PromiseLike<{ data: unknown; error: PostgrestError | null }>) {
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return (data ?? []) as Record<string, unknown>[];
}

// Postgres codes: malformed uuid, unknown class/child/check, duplicate roll number.
const statusForCode: Record<string, 400 | 409> = { "22P02": 400, "23503": 400, "23505": 409 };

export const app = new Hono()
  .use(cors({ origin: "http://localhost:5173" }))
  .get("/health", (c) => c.json({ ok: true }))

  .post("/classes", json(ClassRecord), async (c) => {
    const record = c.req.valid("json");
    await run(db().from("classes").upsert(snake(record)));
    return c.json(record, 201);
  })
  .get("/classes/:id", async (c) => {
    const [row] = await run(db().from("classes").select().eq("id", c.req.param("id")));
    if (!row) return c.json({ error: "Class not found" }, 404);
    return c.json(ClassRecord.parse(camel(row)));
  })

  .post("/classes/:id/children", json(Child.omit({ classId: true }).array()), async (c) => {
    const children = c.req.valid("json").map((child) => ({ ...child, classId: c.req.param("id") }));
    await run(db().from("children").upsert(children.map(snake)));
    return c.json(children, 201);
  })
  .get("/classes/:id/children", async (c) => {
    const rows = await run(db().from("children").select().eq("class_id", c.req.param("id")).order("roll_no"));
    return c.json(Child.array().parse(rows.map(camel)));
  })

  // Writes a row for every child in the class: present unless listed.
  .put("/classes/:id/attendance/:date", json(z.object({ absentChildIds: z.array(z.uuid()) })), async (c) => {
    const { id, date } = c.req.param();
    if (!z.iso.date().safeParse(date).success) return c.json({ error: "Date must be YYYY-MM-DD" }, 400);
    const { absentChildIds } = c.req.valid("json");
    const childIds = (await run(db().from("children").select("id").eq("class_id", id))).map((r) => r.id as string);
    if (absentChildIds.some((childId) => !childIds.includes(childId))) {
      return c.json({ error: "An absent child is not in this class" }, 400);
    }
    const rows: Attendance[] = childIds.map((childId) => ({
      classId: id,
      date,
      childId,
      present: !absentChildIds.includes(childId),
    }));
    await run(db().from("attendance").upsert(rows.map(snake)));
    return c.json(rows);
  })
  .get("/classes/:id/attendance", async (c) => {
    const rows = await run(db().from("attendance").select().eq("class_id", c.req.param("id")).order("date"));
    return c.json(Attendance.array().parse(rows.map(camel)));
  })

  .post("/classes/:id/lessons", json(Lesson.omit({ classId: true })), async (c) => {
    const lesson = { ...c.req.valid("json"), classId: c.req.param("id") };
    await run(db().from("lessons").upsert(snake(lesson)));
    return c.json(lesson, 201);
  })
  // When the teacher clears a day's concept, so the rules no longer count it as taught.
  .delete("/classes/:id/lessons/:lessonId", async (c) => {
    const { id, lessonId } = c.req.param();
    await run(db().from("lessons").delete().eq("id", lessonId).eq("class_id", id));
    return c.body(null, 204);
  })
  .get("/classes/:id/lessons", async (c) => {
    const rows = await run(db().from("lessons").select().eq("class_id", c.req.param("id")).order("date"));
    return c.json(Lesson.array().parse(rows.map(camel)));
  })

  .post("/classes/:id/checks", json(Check.omit({ classId: true })), async (c) => {
    const check = { ...c.req.valid("json"), classId: c.req.param("id") };
    await run(db().from("checks").upsert(snake(check)));
    return c.json(check, 201);
  })
  .post("/checks/:id/answers", json(Answer.omit({ checkId: true }).array()), async (c) => {
    const answers = c.req.valid("json").map((answer) => ({ ...answer, checkId: c.req.param("id") }));
    await run(db().from("answers").upsert(answers.map(snake)));
    return c.json(answers, 201);
  })
  .get("/checks/:id/answers", async (c) => {
    const rows = await run(
      db().from("answers").select().eq("check_id", c.req.param("id")).order("child_id").order("version"),
    );
    return c.json(Answer.array().parse(rows.map(camel)));
  })

  // Bhili speech from services/bhili, cached in the public `audio` bucket by its text.
  // Returns the bucket path, like `file` in the audio manifest.
  .post("/speak", json(z.object({ text: z.string().trim().min(1).max(500) })), async (c) => {
    const { text } = c.req.valid("json");
    const file = `tts/${createHash("sha256").update(text).digest("hex")}.wav`;
    if (!speaking.has(file)) speaking.set(file, makeSpeech(file, text).finally(() => speaking.delete(file)));
    await speaking.get(file);
    return c.json({ file });
  })

  .post("/brief/reword", json(z.object({ brief: z.string().trim().min(1).max(4000) })), async (c) => {
    return c.json({ brief: await rewordBrief(c.req.valid("json").brief) });
  })

  // One photo of several slates, base64, already resized on the phone.
  .post(
    "/slates/read",
    json(z.object({ image: z.base64().min(1).max(8_000_000), mediaType: z.enum(["image/jpeg", "image/png"]) })),
    async (c) => {
      const { image, mediaType } = c.req.valid("json");
      return c.json(await readSlates(image, mediaType));
    },
  );

// Speech takes up to a minute on CPU, so a second request for the same text waits for the first.
const speaking = new Map<string, Promise<void>>();

async function makeSpeech(file: string, text: string) {
  const bucket = db().storage.from("audio");
  const { data: cached } = await bucket.exists(file);
  if (cached) return;
  const res = await fetch(`${process.env.TTS_URL ?? "http://localhost:8790"}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Bhili TTS said ${res.status}`);
  const { error } = await bucket.upload(file, await res.arrayBuffer(), { contentType: "audio/wav", upsert: true });
  if (error) throw new Error(error.message);
}

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  const status = statusForCode[(err as { code?: string }).code ?? ""];
  if (status) return c.json({ error: err.message }, status);
  console.error(err);
  return c.json({ error: "Server error" }, 500);
});
