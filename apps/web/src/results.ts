import { type Check, type Child, type ClassData, childRecord, needsRecheck, type Placement, type RowResult, results, type Version } from "@triveni/core";
import { content } from "./classData";

// The order groups are shown in, matching the brief: the children who need help first.
export const groupOrder: Placement[] = [
  "language_gap",
  "word_problem_gap",
  "symbol_gap",
  "language_symbol_gap",
  "never_taught",
  "taught_not_learned",
  "clip_failed",
  "inconsistent",
  "unclear",
  "not_checked",
  "ready",
];

export type Placed = {
  child: Child;
  placement: Placement;
  // What still has to happen before the child joins a group: a quick re-check, or the probe.
  pending: "recheck" | "probe" | null;
  // What the child's wrong answers show, such as "B: wrote 22, added instead of subtracted".
  notes: string[];
};

const versions: Version[] = ["A", "B", "C"];

function notes(r: RowResult): string[] {
  return versions.flatMap((v) => {
    const a = r.answers[v];
    if (!a?.cause) return [];
    if (a.cause === "copied") return [`${v}: wrote ${a.value}, a number copied from the question`];
    const listed = r.question.wrongAnswers[v].find((w) => w.cause === a.cause);
    return listed ? [`${v}: wrote ${a.value}, ${listed.meaning.charAt(0).toLowerCase()}${listed.meaning.slice(1)}`] : [];
  });
}

// Each child's placement on one row of a check, with what is still pending for their label.
export function placedOnRow(data: ClassData, check: Check, row: number): Placed[] {
  const all = results(data, content);
  const questionId = check.questionIds[row - 1];
  return all
    .filter((r) => r.checkId === check.id && r.question.id === questionId)
    .map((r) => {
      const child = data.children.find((c) => c.id === r.childId)!;
      const label = childRecord(child, data, content, all).concepts[r.conceptId]?.label ?? null;
      const current = label?.placement === r.placement;
      const pending = current && needsRecheck(label) ? "recheck" : current && label?.placement === "taught_not_learned" && !label.confirmed ? "probe" : null;
      return { child, placement: r.placement, pending, notes: notes(r) };
    });
}
