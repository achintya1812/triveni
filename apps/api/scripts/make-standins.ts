import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AudioClip } from "@triveni/core";
import { questions } from "@triveni/content";
import { bulbul } from "../src/bulbul";
import { db } from "../src/db";

// Makes Sarvam Bulbul clips for the Hindi B questions, uploads them to the public `audio` bucket,
// and sets `file` and `source: "bulbul"` in audio.json. C is spoken live in Bhili (POST /speak).
// Skips clips that already have a file. Run seed:audio afterwards.

const manifest = fileURLToPath(new URL("../../../packages/content/data/audio.json", import.meta.url));
const clips = AudioClip.array().parse(JSON.parse(await readFile(manifest, "utf8")));
const scripts = new Map(questions.map((q) => [q.B.audio, q.B.hindi]));

const { data: bucket } = await db().storage.getBucket("audio");
if (!bucket) {
  const { error } = await db().storage.createBucket("audio", { public: true });
  if (error) throw new Error(error.message);
}

for (const clip of clips) {
  const text = scripts.get(clip.id);
  if (!text || clip.file) continue;
  const file = `standins/${clip.id}.mp3`;
  const { error } = await db().storage.from("audio").upload(file, await bulbul(text), { contentType: "audio/mpeg", upsert: true });
  if (error) throw new Error(error.message);
  clip.file = file;
  clip.source = "bulbul";
  console.log(`Made ${file}`);
}

// Keep the one-entry-per-line layout of audio.json.
const line = (clip: AudioClip) =>
  `  { ${Object.entries(clip).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
await writeFile(manifest, `[\n${clips.map(line).join(",\n")}\n]\n`);
