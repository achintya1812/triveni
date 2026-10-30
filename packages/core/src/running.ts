import type { Concept, Keyword, Question } from "./content";
import type { Answer, Attendance, Check, Child, Lesson, ListeningResult, ProbeResult, Version } from "./records";
import { type Label, labelFor, type Mark, type Placement, type PlacementLog, placeMarks, wasTaught } from "./rules";

// Each child's running record (IDEA.md, "What Triveni remembers about each child"). Nothing here is
// stored: it is worked out from the class's records whenever it's needed, so no fixed label is kept.

// Defaults the team agreed (TODO.md, Stage 11). Change them here.
export const thresholds = {
  // A Hindi score from which a child is retaught in Hindi.
  schoolLanguageWell: 0.7,
  // How far the Bhili score must lead the Hindi score to reteach in Bhili first.
  homeLanguageLead: 0.3,
  // Both scores at least this, and ready on the latest check, to sit with a group as a buddy.
  buddyLevel: 0.7,
  // The teacher's own view of how well the child follows Hindi, counted as one result.
  teacherView: { well: 1, some: 0.5, none: 0 },
  // A stumble on a key word counts this much when B's wrong answer points to a key word.
  keywordCauseWeight: 2,
};

// Everything Dexie holds for one class.
export interface ClassData {
  children: Child[];
  checks: Check[];
  answers: Answer[];
  lessons: Lesson[];
  attendance: Attendance[];
  probes: ProbeResult[];
  listening: ListeningResult[];
}

// From @triveni/content (core can't import it: content depends on core).
export interface Content {
  concepts: Concept[];
  questions: Question[];
  keywords: Keyword[];
}

// One child's result on one row (concept) of one check, oldest first.
export interface RowResult extends PlacementLog {
  checkId: string;
  question: Question;
  answers: Partial<Record<Version, Answer>>;
}

export type ConceptStatus = "not_taught" | "taught_not_learned" | "learned" | "not_checked";

export interface ConceptRecord {
  status: ConceptStatus;
  label: Label | null;
  causes: string[];
}

export interface LanguageProfile {
  hindi: number | null;
  bhili: number | null;
  reteachIn: "home" | "mixed" | "school";
}

export interface ChildRecord {
  child: Child;
  concepts: Record<string, ConceptRecord>;
  words: Record<string, { met: number; stumbled: number }>;
  language: LanguageProfile;
  // The child's most recent result, on any concept.
  latest: RowResult | undefined;
  // Where a concept gap started.
  root: (conceptId: string) => string;
}

const versions: Version[] = ["A", "B", "C"];

// Every child's result on every row of every check, oldest first. A child counts as in a check when
// they have answers in it, or were absent that day (so they're never marked wrong).
export function results(data: ClassData, content: Content): RowResult[] {
  const out: RowResult[] = [];
  for (const check of [...data.checks].sort((x, y) => x.date.localeCompare(y.date))) {
    check.questionIds.forEach((questionId, i) => {
      const question = content.questions.find((q) => q.id === questionId);
      if (!question) return;
      for (const child of data.children) {
        if (check.childIds && !check.childIds.includes(child.id)) continue;
        const mine = data.answers.filter((a) => a.checkId === check.id && a.childId === child.id && a.row === i + 1);
        const absent = data.attendance.some((r) => r.date === check.date && r.childId === child.id && !r.present);
        if (mine.length === 0 && !absent) continue;
        const answers = Object.fromEntries(mine.map((a) => [a.version, a])) as RowResult["answers"];
        const mark = (v: Version): Mark => answers[v]?.status ?? "no_data";
        const marks = { a: mark("A"), b: mark("B"), c: child.homeLanguage === "hindi" ? null : mark("C") };
        const placement = placeMarks(child.id, question.conceptId, marks, data.lessons, data.attendance, check.date);
        out.push({ childId: child.id, conceptId: question.conceptId, date: check.date, placement, checkId: check.id, question, answers });
      }
    });
  }
  return out;
}

// Patterns that say nothing about the concept: the next check decides.
const undecided: Placement[] = ["unclear", "inconsistent", "not_checked"];
// The child can do the maths in some form: in numbers, or in a story they understood.
const learnedPlacements: Placement[] = [
  "ready",
  "language_gap",
  "word_problem_gap",
  "symbol_gap",
  "language_symbol_gap",
  "clip_failed",
];

export function childRecord(child: Child, data: ClassData, content: Content, all = results(data, content)): ChildRecord {
  const rows = all.filter((r) => r.childId === child.id);
  const probes = data.probes.filter((p) => p.childId === child.id);
  const taught = (conceptId: string) => wasTaught(child.id, conceptId, data.lessons, data.attendance);

  function status(conceptId: string): ConceptStatus {
    const last = rows.filter((r) => r.conceptId === conceptId && !undecided.includes(r.placement)).at(-1);
    const probe = probes.filter((p) => p.conceptId === conceptId && (!last || p.date >= last.date)).at(-1);
    if (probe?.passedAtOnce) return "learned";
    // A child who missed the lesson but was present when it was taught again counts as taught now.
    if (!last || last.placement === "never_taught") return taught(conceptId) ? "not_checked" : "not_taught";
    if (last.placement === "taught_not_learned") return "taught_not_learned";
    return learnedPlacements.includes(last.placement) ? "learned" : "not_checked";
  }

  const concepts = Object.fromEntries(
    content.concepts.map((c) => {
      const causes = rows
        .filter((r) => r.conceptId === c.id)
        .flatMap((r) => versions.map((v) => r.answers[v]?.cause))
        .filter((cause): cause is string => !!cause && cause !== "copied");
      return [c.id, { status: status(c.id), label: labelFor(child.id, c.id, all, probes), causes: [...new Set(causes)] }];
    }),
  );

  function root(conceptId: string): string {
    // 1. A wrong answer that points to a concept, latest first: 11 for 14 − 5 points to borrowing.
    for (const r of [...rows].reverse()) {
      if (r.conceptId !== conceptId) continue;
      for (const v of versions) {
        const answer = r.answers[v];
        const listed = r.question.wrongAnswers[v].find((w) => answer?.cause && w.cause === answer.cause);
        if (listed?.pointsTo === "concept" && listed.conceptId) return listed.conceptId;
      }
    }
    // 2. The prerequisites, nearest first: one the child was never taught, or else one not learned.
    const order = prerequisitesNearestFirst(conceptId, content.concepts);
    return (
      order.find((id) => concepts[id]?.status === "not_taught") ??
      order.find((id) => concepts[id]?.status === "taught_not_learned") ??
      conceptId
    );
  }

  return { child, concepts, words: words(rows), language: language(child, rows, data.listening), latest: rows.at(-1), root };
}

function prerequisitesNearestFirst(conceptId: string, concepts: Concept[]): string[] {
  const order: string[] = [];
  let level = [conceptId];
  while (level.length > 0) {
    const next = level
      .flatMap((id) => concepts.find((c) => c.id === id)?.prerequisites ?? [])
      .filter((id) => !order.includes(id) && id !== conceptId);
    order.push(...new Set(next));
    level = [...new Set(next)];
  }
  return order;
}

// A key word is met whenever a B question tagged with it is answered, and stumbled on when B is wrong
// while A and C are right (a language gap).
function words(rows: RowResult[]): ChildRecord["words"] {
  const out: ChildRecord["words"] = {};
  for (const r of rows) {
    const b = r.answers.B;
    if (!b || b.status === "no_data") continue;
    const onKeyword = r.question.wrongAnswers.B.find((w) => w.cause === b.cause)?.pointsTo === "keyword";
    for (const id of r.question.keywordIds) {
      out[id] ??= { met: 0, stumbled: 0 };
      out[id].met += 1;
      if (r.placement === "language_gap") out[id].stumbled += onKeyword ? thresholds.keywordCauseWeight : 1;
    }
  }
  return out;
}

const score = (results: number[]) => (results.length ? results.reduce((s, x) => s + x, 0) / results.length : null);
const asResult = (mark: Mark | undefined) => (mark === "right" ? [1] : mark === "wrong" ? [0] : []);

// How well the child follows each language, from 0 to 1: the listening check, and B (Hindi) and
// C (Bhili) on checks where A was right, so the maths isn't what failed.
function language(child: Child, rows: RowResult[], listening: ListeningResult[]): LanguageProfile {
  const heard = listening.filter((l) => l.childId === child.id);
  const solved = rows.filter((r) => r.answers.A?.status === "right");
  const hindi = score([
    ...heard.filter((l) => l.language === "hindi").flatMap((l) => asResult(l.status)),
    ...solved.flatMap((r) => asResult(r.answers.B?.status)),
    ...(child.hindiUnderstanding ? [thresholds.teacherView[child.hindiUnderstanding]] : []),
  ]);
  const bhili = score([
    ...heard.filter((l) => l.language === "bhili").flatMap((l) => asResult(l.status)),
    ...solved.flatMap((r) => asResult(r.answers.C?.status)),
  ]);
  return { hindi, bhili, reteachIn: reteachIn(child, hindi, bhili) };
}

function reteachIn(child: Child, hindi: number | null, bhili: number | null): LanguageProfile["reteachIn"] {
  if (child.homeLanguage === "hindi") return "school";
  if (hindi !== null && hindi >= thresholds.schoolLanguageWell) return "school";
  if (hindi === null || bhili === null) return "home";
  return bhili - hindi >= thresholds.homeLanguageLead ? "home" : "mixed";
}

// Children who follow both languages well and were ready on their latest check: they can sit with a
// group and repeat instructions in the home language.
export function buddies(records: ChildRecord[]): Child[] {
  const both = (l: LanguageProfile) =>
    l.hindi !== null && l.bhili !== null && l.hindi >= thresholds.buddyLevel && l.bhili >= thresholds.buddyLevel;
  return records.filter((r) => r.latest?.placement === "ready" && both(r.language)).map((r) => r.child);
}
