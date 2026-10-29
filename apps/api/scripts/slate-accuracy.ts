import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { readSlates } from "../src/slates";

// Measures how well Claude reads slates. Usage: pnpm --filter @triveni/api slate:accuracy <folder>
// The folder holds photos (.jpg or .png) and answers.csv with the true answers, one row per slate:
//   photo,roll,A,B,C
//   row1.jpg,1,9,21,6
// An empty cell is an empty box. Leave C empty for children who speak Hindi at home.
// Each photo is one paid Claude call.

const folder = process.argv[2];
if (!folder) throw new Error("Usage: slate:accuracy <folder with photos and answers.csv>");

const versions = ["A", "B", "C"] as const;
const [header, ...lines] = (await readFile(join(folder, "answers.csv"), "utf8")).trim().split(/\r?\n/);
if (header.replace(/\s/g, "") !== "photo,roll,A,B,C") throw new Error("answers.csv must start with photo,roll,A,B,C");
const truth = lines.map((line) => {
  const [photo, roll, ...boxes] = line.split(",").map((cell) => cell.trim());
  return { photo, roll: Number(roll), boxes: boxes.map((b) => (b === "" ? null : Number(b))) };
});

const photos = (await readdir(folder)).filter((f) => [".jpg", ".jpeg", ".png"].includes(extname(f).toLowerCase()));
const total = { slates: 0, found: 0, boxes: 0, right: 0, flagged: 0, confidentWrong: 0 };

for (const photo of photos.sort()) {
  const expected = truth.filter((t) => t.photo === photo);
  if (expected.length === 0) {
    console.log(`${photo}: not in answers.csv, skipped`);
    continue;
  }
  const image = (await readFile(join(folder, photo))).toString("base64");
  const { slates } = await readSlates(image, extname(photo).toLowerCase() === ".png" ? "image/png" : "image/jpeg");

  const counts = { found: 0, boxes: 0, right: 0, flagged: 0, confidentWrong: 0 };
  for (const slate of expected) {
    const read = slates.find((s) => s.roll === slate.roll);
    if (read) counts.found++;
    versions.forEach((version, i) => {
      // C is checked only on slates that have one: Hindi-home children leave it out.
      if (version === "C" && slate.boxes[i] === null && !read?.answers.some((a) => a.row === 1 && a.version === "C")) {
        return;
      }
      const box = read?.answers.find((a) => a.row === 1 && a.version === version);
      const right = !!box && box.value === slate.boxes[i];
      const flagged = !!box && box.confidence < 0.8; // the app's lowConfidence
      counts.boxes++;
      if (right) counts.right++;
      if (flagged) counts.flagged++;
      if (box && !right && !flagged) counts.confidentWrong++;
    });
  }
  console.log(
    `${photo}: ${counts.found}/${expected.length} rolls found, ${counts.right}/${counts.boxes} boxes right, ` +
      `${counts.flagged} flagged, ${counts.confidentWrong} wrong but not flagged`,
  );
  total.slates += expected.length;
  for (const key of ["found", "boxes", "right", "flagged", "confidentWrong"] as const) total[key] += counts[key];
}

const pct = (n: number, d: number) => (d === 0 ? "-" : `${((100 * n) / d).toFixed(0)}%`);
console.log(`\nRolls found: ${total.found}/${total.slates} (${pct(total.found, total.slates)})`);
console.log(`Boxes right: ${total.right}/${total.boxes} (${pct(total.right, total.boxes)})`);
console.log(`Flagged for the teacher: ${total.flagged}`);
console.log(`Wrong but not flagged (the ones that matter): ${total.confidentWrong}`);
