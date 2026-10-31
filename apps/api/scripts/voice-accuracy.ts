import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { transcribe } from "../src/saaras";
import { conceptForNote, keyterms } from "../src/voice";

// Measures how well voice notes map to concepts. Usage: pnpm --filter @triveni/api voice:accuracy <folder>
// The folder holds the recorded notes (.webm, .ogg, .m4a, .mp3 or .wav, each under 30 seconds) and truth.csv,
// one row per note with the concept the teacher meant (an id from concepts.json, or none):
//   file,conceptId
//   note-1.webm,borrowing
// Each note is one Sarvam call, and one Claude call when it gives no page.

const folder = process.argv[2];
if (!folder) throw new Error("Usage: voice:accuracy <folder with notes and truth.csv>");

const types: Record<string, string> = {
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};
const [header, ...lines] = (await readFile(join(folder, "truth.csv"), "utf8")).trim().split(/\r?\n/);
if (header.replace(/\s/g, "") !== "file,conceptId") throw new Error("truth.csv must start with file,conceptId");
const truth = new Map(lines.map((line) => line.split(",").map((cell) => cell.trim()) as [string, string]));

const files = (await readdir(folder)).filter((f) => extname(f).toLowerCase() in types).sort();
const total = { notes: 0, right: 0, byPage: 0, byPageRight: 0 };
for (const file of files) {
  const expected = truth.get(file);
  if (!expected) {
    console.log(`${file}: not in truth.csv, skipped`);
    continue;
  }
  const transcript = await transcribe(await readFile(join(folder, file)), types[extname(file).toLowerCase()], keyterms);
  const { page, conceptId, via } = await conceptForNote(transcript);
  const right = (conceptId ?? "none") === expected;
  total.notes++;
  if (right) total.right++;
  if (via === "page") {
    total.byPage++;
    if (right) total.byPageRight++;
  }
  console.log(
    `${right ? "✓" : "✗"} ${file}: "${transcript}"\n    ${via}${page === null ? "" : `, page ${page}`} → ${conceptId ?? "none"}` +
      `${right ? "" : ` (should be ${expected})`}`,
  );
}

console.log(`\nRight: ${total.right}/${total.notes}`);
console.log(`By page: ${total.byPageRight}/${total.byPage} right; by Claude: ${total.right - total.byPageRight}/${total.notes - total.byPage} right`);
