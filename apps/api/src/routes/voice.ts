import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { json } from "../http";
import { transcribe } from "../saaras";
import { conceptForNote, keyterms } from "../voice";

// The teacher's voice note about what she taught: stored, transcribed, and matched to a concept.
// The phone records webm/Opus (Safari: mp4), base64, under 30 seconds.
export const voice = new Hono().post(
  "/voice-notes",
  json(
    z.object({
      classId: z.uuid(),
      audio: z.base64().min(1).max(2_000_000),
      mimeType: z.string().regex(/^audio\/(webm|ogg|mp4|mpeg)/),
    }),
  ),
  async (c) => {
    const { classId, audio, mimeType } = c.req.valid("json");
    const file = Buffer.from(audio, "base64");
    const format = mimeType.split("/")[1].split(";")[0];
    const { error } = await db()
      .storage.from("voice-notes")
      .upload(`${classId}/${crypto.randomUUID()}.${format}`, file, { contentType: mimeType });
    if (error) throw new Error(error.message);
    const transcript = await transcribe(file, mimeType, keyterms);
    return c.json({ transcript, ...(await conceptForNote(transcript)) });
  },
);
