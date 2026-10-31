import { type Answer, type Child, markAnswer, type Question, type SlateReading } from "@triveni/core";

export type Version = Answer["version"];

// What's in each box: digits, or "" for a blank. Typed by the teacher or read from slate photos.
export type GridValues = Record<string, Partial<Record<Version, string>>>;

// Boxes read from a slate photo: Claude's confidence, and whether the teacher has since checked the box.
export type GridReads = Record<string, Partial<Record<Version, { confidence: number; reviewed: boolean }>>>;

// One grid per row on the slate (one row per concept in the check).
export type Grid = { values: GridValues; reads: GridReads };

// Below this, a box read from a photo is flagged for the teacher to check.
export const lowConfidence = 0.8;

export const isFlagged = (read: { confidence: number; reviewed: boolean } | undefined) =>
  !!read && !read.reviewed && read.confidence < lowConfidence;

// Children whose home language is Hindi have no C: B already asks them in their own language.
export const versionsFor = (child: Child): Version[] =>
  child.homeLanguage === "hindi" ? ["A", "B"] : ["A", "B", "C"];

// One answer per box, blanks included, so a blank is stored as no_data rather than missing.
export function markGrid(
  checkId: string,
  question: Question,
  children: Child[],
  values: GridValues,
  reads: GridReads = {},
  row = 1,
): Answer[] {
  return children.flatMap((child) =>
    versionsFor(child).map((version) => {
      const raw = values[child.id]?.[version] ?? "";
      const value = raw === "" ? null : Number(raw);
      const read = reads[child.id]?.[version];
      return {
        checkId,
        childId: child.id,
        questionId: question.id,
        row,
        version,
        value,
        ...markAnswer(value, question, version),
        confidence: read?.confidence ?? null,
        reviewed: read?.reviewed ?? true,
      };
    }),
  );
}

// Puts the slates read from one photo into the grids, matching slates to children by roll number.
// Row n on a slate goes into grids[n - 1]; rows beyond the check's are ignored.
// A later photo overwrites a roll read earlier.
export function applySlates(roster: Child[], grids: Grid[], reading: SlateReading): Grid[] {
  const next = grids.map((g) => ({ values: { ...g.values }, reads: { ...g.reads } }));
  for (const slate of reading.slates) {
    const child = roster.find((c) => c.rollNo === slate.roll);
    if (!child) continue;
    for (const answer of slate.answers) {
      const grid = next[answer.row - 1];
      if (!grid || !versionsFor(child).includes(answer.version)) continue;
      grid.values[child.id] = { ...grid.values[child.id], [answer.version]: answer.value === null ? "" : String(answer.value) };
      grid.reads[child.id] = { ...grid.reads[child.id], [answer.version]: { confidence: answer.confidence, reviewed: false } };
    }
  }
  return next;
}

// Problems with the roll numbers across every photo read so far, for the teacher to sort out.
export function rollFlags(roster: Child[], rolls: (number | null)[]) {
  const count = (roll: number) => rolls.filter((r) => r === roll).length;
  const known = new Set(roster.map((c) => c.rollNo));
  return {
    unreadable: rolls.filter((r) => r === null).length,
    unknown: [...new Set(rolls.filter((r): r is number => r !== null && !known.has(r)))],
    duplicate: roster.filter((c) => count(c.rollNo) > 1),
    missing: rolls.length === 0 ? [] : roster.filter((c) => count(c.rollNo) === 0),
  };
}
