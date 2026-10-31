import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { placeSlate, type Slate } from "@triveni/core";
import { type Effort, readSlates } from "../src/slates";

// Measures how well Claude reads slates. Usage:
//   pnpm --filter @triveni/api slate:accuracy <folder> [--effort low|medium]
// The folder holds photos (.jpg or .png) and answers.csv with the truth, one row per slate, listed in reading
// order (left to right, then top to bottom):
//   photo,roll,name,wrote,A,B,C
//   notebook-1.jpg,12,Meena,both,9,8,6
// - roll and name: whose slate it is, as in the class list. The class list sent to Claude is every roll and
//   name in the file.
// - wrote: what's written on the slate to say whose it is: roll, name or both (roll if left out).
// - A, B, C: the row 1 answers. An empty cell is an empty box. Leave C empty for children who speak Hindi at home.
// `name` and `wrote` are optional columns, so the MVP's samples (photo,roll,A,B,C) still work.
// For the baseline, run mvp-demo-v1's script on the same photos: its "Rolls found" counts the same way as
// "Rolls read right" here.
// Each photo is one paid Claude call.

const args = process.argv.slice(2);
const folder = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--effort");
const effortArg = args[args.indexOf("--effort") + 1];
const effort: Effort = args.includes("--effort") ? (effortArg as Effort) : "low";
if (!folder || !["low", "medium"].includes(effort)) {
  throw new Error("Usage: slate:accuracy <folder with photos and answers.csv> [--effort low|medium]");
}

const versions = ["A", "B", "C"] as const;
const [header, ...lines] = (await readFile(join(folder, "answers.csv"), "utf8")).trim().split(/\r?\n/);
const columns = header.split(",").map((c) => c.trim());
for (const needed of ["photo", "roll", ...versions]) {
  if (!columns.includes(needed)) throw new Error(`answers.csv needs a ${needed} column`);
}
const truth = lines.map((line) => {
  const cells = line.split(",").map((cell) => cell.trim());
  const cell = (column: string) => cells[columns.indexOf(column)] ?? "";
  const roll = Number(cell("roll"));
  const wrote = cell("wrote") || "roll";
  return {
    photo: cell("photo"),
    rollNo: roll,
    name: cell("name") || `Child ${roll}`,
    wroteRoll: wrote === "roll" || wrote === "both",
    wroteName: wrote === "name" || wrote === "both",
    boxes: versions.map((v) => (cell(v) === "" ? null : Number(cell(v)))),
  };
});
const roster = [...new Map(truth.map((t) => [t.rollNo, { rollNo: t.rollNo, name: t.name }])).values()];

const photos = (await readdir(folder)).filter((f) => [".jpg", ".jpeg", ".png"].includes(extname(f).toLowerCase()));
const total = {
  slates: 0,
  rollsWritten: 0,
  rollsRight: 0,
  compared: 0,
  placedRight: 0,
  unplaced: 0,
  wrongChild: 0,
  nameOnly: 0,
  nameOnlyPlaced: 0,
  boxes: 0,
  right: 0,
  flagged: 0,
  confidentWrong: 0,
};
const misreads: string[] = [];
const describe = (s: Slate) =>
  `read ${s.roll ?? "nothing"} (written '${s.rollAsWritten ?? ""}', confidence ${s.rollConfidence.toFixed(2)}${s.name ? `, name '${s.name}'` : ""})`;

console.log(`Effort: ${effort}\n`);
for (const photo of photos.sort()) {
  const expected = truth.filter((t) => t.photo === photo);
  if (expected.length === 0) {
    console.log(`${photo}: not in answers.csv, skipped`);
    continue;
  }
  const image = (await readFile(join(folder, photo))).toString("base64");
  const mediaType = extname(photo).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
  const { slates } = await readSlates(image, mediaType, roster.map((c) => ({ roll: c.rollNo, name: c.name })), 1, effort);
  total.slates += expected.length;

  // Rolls, counted as mvp-demo-v1 did: a slate's roll is right if some slate in the photo was read with it.
  const written = expected.filter((t) => t.wroteRoll);
  const rollsRight = written.filter((t) => slates.some((s) => s.roll === t.rollNo)).length;
  total.rollsWritten += written.length;
  total.rollsRight += rollsRight;

  // Slates pair with the truth by reading order, which only works when every slate was read.
  if (slates.length !== expected.length) {
    console.log(`${photo}: read ${slates.length} slates, expected ${expected.length}; placement and boxes not compared`);
    continue;
  }
  const counts = { placedRight: 0, unplaced: 0, wrongChild: 0, right: 0, boxes: 0 };
  expected.forEach((t, i) => {
    const read = slates[i];
    if (t.wroteRoll && read.roll !== t.rollNo) misreads.push(`${photo}, slate ${i + 1}: roll ${t.rollNo}, ${describe(read)}`);
    const placed = placeSlate(roster, read);
    if (!placed) counts.unplaced++;
    else if (placed.rollNo === t.rollNo) counts.placedRight++;
    else {
      counts.wrongChild++;
      misreads.push(`${photo}, slate ${i + 1}: GIVEN TO THE WRONG CHILD (roll ${placed.rollNo}, should be ${t.rollNo}), ${describe(read)}`);
    }
    if (t.wroteName && !t.wroteRoll) {
      total.nameOnly++;
      if (placed?.rollNo === t.rollNo) total.nameOnlyPlaced++;
    }

    versions.forEach((version, j) => {
      // C is checked only on slates that have one: Hindi-home children leave it out.
      if (version === "C" && t.boxes[j] === null && !read.answers.some((a) => a.row === 1 && a.version === "C")) return;
      const box = read.answers.find((a) => a.row === 1 && a.version === version);
      const right = !!box && box.value === t.boxes[j];
      const flagged = !!box && box.confidence < 0.8; // the app's lowConfidence
      counts.boxes++;
      if (right) counts.right++;
      if (flagged) total.flagged++;
      if (box && !right && !flagged) total.confidentWrong++;
    });
  });
  total.compared += expected.length;
  total.placedRight += counts.placedRight;
  total.unplaced += counts.unplaced;
  total.wrongChild += counts.wrongChild;
  total.boxes += counts.boxes;
  total.right += counts.right;
  console.log(
    `${photo}: ${rollsRight}/${written.length} rolls read right, ${counts.placedRight}/${expected.length} placed, ` +
      `${counts.unplaced} unplaced, ${counts.wrongChild} wrong child, ${counts.right}/${counts.boxes} boxes right`,
  );
}

const pct = (n: number, d: number) => (d === 0 ? "-" : `${((100 * n) / d).toFixed(0)}%`);
if (misreads.length > 0) console.log(`\nMisread rolls:\n${misreads.map((m) => `  ${m}`).join("\n")}`);
console.log(`\nRolls read right: ${total.rollsRight}/${total.rollsWritten} (${pct(total.rollsRight, total.rollsWritten)})`);
console.log(`Slates placed: ${total.placedRight}/${total.compared}, unplaced ${total.unplaced}, given to the wrong child ${total.wrongChild}`);
console.log(`Name-only slates placed by name: ${total.nameOnlyPlaced}/${total.nameOnly}`);
console.log(`Boxes right: ${total.right}/${total.boxes} (${pct(total.right, total.boxes)})`);
console.log(`Flagged for the teacher: ${total.flagged}`);
console.log(`Wrong but not flagged (the ones that matter): ${total.confidentWrong}`);
