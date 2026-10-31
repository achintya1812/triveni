import { createHash } from "node:crypto";
import { concepts, kits } from "@triveni/content";
import { db } from "../src/db";
import { voiceNote } from "../src/telegram";

// Makes every parent voice note (each concept's catch-up lesson and each kit's home activity, in Bhili and
// Hindi) as the OGG/Opus file Telegram plays, so the deployed API never needs ffmpeg. Needs ffmpeg here,
// and every clip already made (warm:speech). With --check, nothing is made: it lists what's missing.

const check = process.argv.includes("--check");
const texts = [...concepts.map((c) => c.catchUp), ...kits.map((k) => k.parentActivity)].flatMap((t) => [
  { text: t.bhili, language: "bhili" as const },
  { text: t.hindi, language: "hindi" as const },
]);

let missing = 0;
for (const { text, language } of texts) {
  if (check) {
    const file = `tg/${createHash("sha256").update(`${language}:${text}`).digest("hex")}.ogg`;
    const { data: cached } = await db().storage.from("audio").exists(file);
    if (!cached) {
      missing += 1;
      console.log(`missing  ${language}  ${text.slice(0, 60)}…`);
    }
    continue;
  }
  console.log(`${await voiceNote(text, language)}  ${language}  ${text.slice(0, 50)}…`);
}
if (check) {
  console.log(missing ? `${missing} of ${texts.length} parent voice notes not made yet. Run telegram:warm.` : `All ${texts.length} parent voice notes are made.`);
  if (missing) process.exit(1);
}
