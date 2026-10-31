import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { db } from "./db";
import { speech } from "./routes/speak";

// Telegram's Bot API over fetch: no SDK. TELEGRAM_BOT_TOKEN comes from @BotFather.

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("Set TELEGRAM_BOT_TOKEN in apps/api/.env");
  return t;
}

// Calls a Bot API method, and throws Telegram's description when it fails.
export async function telegram<T = unknown>(method: string, body: object): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

// Downloads a file a parent sent, such as a voice reply.
export async function telegramFile(fileId: string): Promise<Buffer> {
  const { file_path } = await telegram<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${file_path}`);
  if (!res.ok) throw new Error(`Telegram file download said ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// A text as a Telegram voice message: the cached clip (made first if needed), converted once to OGG/Opus,
// because Telegram plays WAV only as a file. Returns its path in the public `audio` bucket.
export async function voiceNote(text: string, language: "bhili" | "hindi") {
  const file = `tg/${createHash("sha256").update(`${language}:${text}`).digest("hex")}.ogg`;
  const bucket = db().storage.from("audio");
  const { data: cached } = await bucket.exists(file);
  if (cached) return file;
  const { data: clip, error } = await bucket.download(await speech(text, language));
  if (error) throw new Error(error.message);
  const { error: uploadError } = await bucket.upload(file, await toOgg(Buffer.from(await clip.arrayBuffer())), {
    contentType: "audio/ogg",
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);
  return file;
}

export const publicUrl = (file: string) => db().storage.from("audio").getPublicUrl(file).data.publicUrl;

// Needs ffmpeg (with libopus) on the PATH.
function toOgg(audio: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-c:a", "libopus", "-b:a", "32k", "-f", "ogg", "pipe:1"]);
    const out: Buffer[] = [];
    let problem = "";
    ffmpeg.stdout.on("data", (d: Buffer) => out.push(d));
    ffmpeg.stderr.on("data", (d: Buffer) => (problem += d));
    ffmpeg.on("error", (e) => reject(new Error(`ffmpeg couldn't start (${e.message}). Install ffmpeg on the API's machine.`)));
    ffmpeg.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg failed: ${problem}`))));
    ffmpeg.stdin.end(audio);
  });
}
