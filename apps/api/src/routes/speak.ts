import { createHash } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { bulbul } from "../bulbul";
import { db } from "../db";
import { json } from "../http";

const Speech = z.object({
  text: z.string().trim().min(1).max(2500),
  language: z.enum(["bhili", "hindi"]).default("bhili"),
  // Only report whether the clip is cached, without making it (warm:speech --check).
  cachedOnly: z.boolean().default(false),
});

// Speech cached in the public `audio` bucket by language and text. Returns the bucket path, like `file`
// in the audio manifest. Bhili comes from services/bhili (TTS_URL); Hindi from Sarvam Bulbul.
// The deployed API has no Bhili speech service, so every Bhili clip must be made beforehand (warm:speech).
export const speak = new Hono().post("/speak", json(Speech), async (c) => {
  const { text, language, cachedOnly } = c.req.valid("json");
  if (cachedOnly) {
    const file = speechFile(text, language);
    const { data: cached } = await db().storage.from("audio").exists(file);
    return cached ? c.json({ file }) : c.json({ error: "Not made yet" }, 404);
  }
  return c.json({ file: await speech(text, language) });
});

const speechFile = (text: string, language: "bhili" | "hindi") =>
  `tts/${language}/${createHash("sha256").update(text).digest("hex")}.${language === "bhili" ? "wav" : "mp3"}`;

// The cached clip for a text, made first if it isn't cached yet. Returns its path in the `audio` bucket.
export async function speech(text: string, language: "bhili" | "hindi") {
  const file = speechFile(text, language);
  if (!speaking.has(file)) speaking.set(file, makeSpeech(file, text, language).finally(() => speaking.delete(file)));
  await speaking.get(file);
  return file;
}

// Speech can take up to a minute on CPU, so a second request for the same text waits for the first.
const speaking = new Map<string, Promise<void>>();

async function makeSpeech(file: string, text: string, language: "bhili" | "hindi") {
  const bucket = db().storage.from("audio");
  const { data: cached } = await bucket.exists(file);
  if (cached) return;
  const audio = language === "bhili" ? await bhili(text) : await hindi(text);
  const { error } = await bucket.upload(file, audio, {
    contentType: language === "bhili" ? "audio/wav" : "audio/mpeg",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

async function bhili(text: string) {
  let res: Response;
  try {
    res = await fetch(`${process.env.TTS_URL ?? "http://localhost:8790"}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new HTTPException(503, { message: "This Bhili clip hasn't been made yet, and the speech service isn't running." });
  }
  if (!res.ok) throw new Error(`Bhili TTS said ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function hindi(text: string) {
  try {
    return await bulbul(text);
  } catch (e) {
    throw new HTTPException(502, { message: `Hindi speech failed: ${(e as Error).message}` });
  }
}
