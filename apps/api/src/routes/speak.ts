import { createHash } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { json } from "../http";

// Bhili speech from services/bhili, cached in the public `audio` bucket by its text.
// Returns the bucket path, like `file` in the audio manifest.
export const speak = new Hono().post("/speak", json(z.object({ text: z.string().trim().min(1).max(500) })), async (c) => {
  const { text } = c.req.valid("json");
  const file = `tts/${createHash("sha256").update(text).digest("hex")}.wav`;
  if (!speaking.has(file)) speaking.set(file, makeSpeech(file, text).finally(() => speaking.delete(file)));
  await speaking.get(file);
  return c.json({ file });
});

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
