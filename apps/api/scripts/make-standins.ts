import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AudioClip } from "@triveni/core";
import { questions } from "@triveni/content";
import { db } from "../src/db";

// Makes Sarvam Bulbul stand-ins for the check clips (B and C) until the human recordings arrive,
// uploads them to the public `audio` bucket, and sets `file` and `source: "bulbul"` in audio.json.
// C has no Bhili text, so its stand-in reads the Hindi script: it only tests the flow.
// The check refuses stand-ins unless VITE_DEV_ALLOW_STANDINS=true.
// Skips clips that already have a file. Run seed:audio afterwards.

const manifest = fileURLToPath(new URL("../../../packages/content/data/audio.json", import.meta.url));
const clips = AudioClip.array().parse(JSON.parse(await readFile(manifest, "utf8")));
const scripts = new Map(questions.flatMap((q) => [[q.B.audio, q.B.hindi], [q.C.audio, q.C.scriptHi]]));

const key = process.env.SARVAM_API_KEY;
if (!key) throw new Error("Set SARVAM_API_KEY in apps/api/.env");

const { data: bucket } = await db().storage.getBucket("audio");
if (!bucket) {
  const { error } = await db().storage.createBucket("audio", { public: true });
  if (error) throw new Error(error.message);
}

for (const clip of clips) {
  const text = scripts.get(clip.id);
  if (!text || clip.file) continue;
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, language_code: "hi-IN", model: "bulbul:v3", output_audio_codec: "mp3" }),
  });
  if (!res.ok) throw new Error(`Sarvam said ${res.status} for ${clip.id}: ${await res.text()}`);
  const { audios } = (await res.json()) as { audios: string[] };

  const file = `standins/${clip.id}.mp3`;
  const { error } = await db()
    .storage.from("audio")
    .upload(file, Buffer.from(audios.join(""), "base64"), { contentType: "audio/mpeg", upsert: true });
  if (error) throw new Error(error.message);
  clip.file = file;
  clip.source = "bulbul";
  console.log(`Made ${file}`);
}

// Keep the one-entry-per-line layout of audio.json.
const line = (clip: AudioClip) =>
  `  { ${Object.entries(clip).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
await writeFile(manifest, `[\n${clips.map(line).join(",\n")}\n]\n`);
