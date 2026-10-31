import type { Concept, Question } from "./content";
import type { Answer, Attendance, Check, Child, Lesson, ProbeResult, Version } from "./records";
import { type Mark, needsRecheck } from "./rules";
import { type ClassData, type Content, childRecord, results } from "./running";

// A simulated class of made-up children, each with a hidden cause planted in advance (IDEA.md,
// "How we test it"). Their answers go through the rules over several weekly checks, with the
// re-checks and probes the rules ask for, and we measure how often the true cause is found and
// after how many checks. No API calls.

export type Cause = "none" | "language_gap" | "word_problem_gap" | "symbol_gap" | "concept_gap" | "absent";
export const causes: Cause[] = ["none", "language_gap", "word_problem_gap", "symbol_gap", "concept_gap", "absent"];

export interface SimulationOptions {
  classes: number;
  childrenPerClass: number;
  // Chance that a box comes out unlike the child's real ability (a slip or a lucky guess).
  careless: number;
  // Chance that a child leaves a box blank, and that a child is absent on any day.
  blank: number;
  absence: number;
  seed: number;
}

export const defaultOptions: SimulationOptions = {
  classes: 100,
  childrenPerClass: 30,
  careless: 0.08,
  blank: 0.03,
  absence: 0.05,
  seed: 1,
};

export interface CauseResult {
  cause: Cause;
  children: number;
  // Found by the last check: the matching label, confirmed. For "none", no confirmed gap at all.
  found: number;
  // For each child found, the number of weekly checks it took.
  checksToFind: number[];
  // Children who carry a confirmed label that doesn't match their cause.
  wrongLabel: number;
}

// The chain the checks cover, and when each concept is taught and checked.
const chain = ["numbers-to-20", "subtraction-within-20", "borrowing", "two-digit-subtraction"];
const concepts: Concept[] = chain.map((id, i) => ({
  id,
  name: id,
  nameHi: id,
  prerequisites: i === 0 ? [] : [chain[i - 1]],
  pages: [],
  reteach: { english: "", bhili: "" },
  catchUp: { english: "", hindi: "", bhili: "" },
  probe: [],
}));
// Only the marks matter here, so the questions have no numbers worth reading.
const questions: Question[] = chain.flatMap((conceptId) =>
  (["weekly", "recheck"] as const).map((use) => ({
    id: `${use}-${conceptId}`,
    conceptId,
    keywordIds: [],
    A: { prompt: "", answer: 1 },
    B: { hindi: "", english: "", answer: 1, audio: "" },
    C: { scriptHi: "", bhili: "", english: "", answer: 1 },
    use,
    wrongAnswers: { A: [], B: [], C: [] },
  })),
);
const content: Content = { concepts, questions, keywords: [] };

// Week by week: the concept taught Monday to Thursday, and the concepts on Friday's check.
const weeks: { taught: string; checked: string[] }[] = [
  { taught: "subtraction-within-20", checked: ["subtraction-within-20"] },
  { taught: "borrowing", checked: ["borrowing"] },
  { taught: "two-digit-subtraction", checked: ["borrowing", "two-digit-subtraction"] },
  { taught: "two-digit-subtraction", checked: ["two-digit-subtraction"] },
];
const firstMonday = Date.UTC(2026, 8, 7);
const day = (week: number, weekday: number) =>
  new Date(firstMonday + (week * 7 + weekday) * 86_400_000).toISOString().slice(0, 10);

// The share of children with each cause, in a class.
const mix: [Cause, number][] = [
  ["none", 0.4],
  ["language_gap", 0.2],
  ["word_problem_gap", 0.1],
  ["symbol_gap", 0.1],
  ["concept_gap", 0.1],
  ["absent", 0.1],
];

// A small seeded generator (mulberry32), so a run can be repeated exactly.
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Pupil {
  child: Child;
  cause: Cause;
}

// What the child would get right with no slips. A concept gap starts at borrowing; an absent
// child was never taught borrowing, so they can't do it or what builds on it.
function knows(cause: Cause, conceptId: string) {
  const later = chain.indexOf(conceptId) >= chain.indexOf("borrowing");
  return !(later && (cause === "concept_gap" || cause === "absent"));
}
function ability(cause: Cause, conceptId: string, version: Version) {
  if (!knows(cause, conceptId)) return false;
  if (version === "A") return cause !== "symbol_gap";
  if (version === "B") return cause !== "language_gap" && cause !== "word_problem_gap";
  return cause !== "word_problem_gap";
}

// The confirmed label that would mean the cause was found.
function found(cause: Cause, record: ReturnType<typeof childRecord>) {
  const labels = Object.entries(record.concepts).flatMap(([id, c]) => (c.label?.confirmed ? [{ id, label: c.label }] : []));
  const gaps = labels.filter((l) => l.label.placement !== "ready");
  const is = (placement: string) => gaps.some((l) => l.label.placement === placement);
  switch (cause) {
    case "none":
      return gaps.length === 0;
    case "concept_gap":
      return gaps.some((l) => l.label.placement === "taught_not_learned" && record.root(l.id) === "borrowing");
    case "absent":
      return gaps.some((l) => l.label.placement === "never_taught" && l.id === "borrowing");
    default:
      return is(cause);
  }
}

// The confirmed gap labels that don't belong to the child's cause.
function wrongLabels(cause: Cause, record: ReturnType<typeof childRecord>) {
  const expected: Record<Cause, string[]> = {
    none: [],
    language_gap: ["language_gap"],
    word_problem_gap: ["word_problem_gap"],
    symbol_gap: ["symbol_gap"],
    // A child who can't do borrowing also fails what builds on it, in the same way.
    concept_gap: ["taught_not_learned"],
    absent: ["never_taught", "taught_not_learned"],
  };
  return Object.values(record.concepts).some(
    (c) => c.label?.confirmed && c.label.placement !== "ready" && !expected[cause].includes(c.label.placement),
  );
}

export function simulate(options: SimulationOptions = defaultOptions): CauseResult[] {
  const rand = random(options.seed);
  const pick = <T>(items: [T, number][]) => {
    let r = rand();
    for (const [item, share] of items) if ((r -= share) < 0) return item;
    return items[items.length - 1][0];
  };
  const totals = new Map<Cause, CauseResult>(
    causes.map((cause) => [cause, { cause, children: 0, found: 0, checksToFind: [], wrongLabel: 0 }]),
  );
  let ids = 0;
  const id = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`;

  for (let k = 0; k < options.classes; k++) {
    const classId = id();
    const pupils: Pupil[] = Array.from({ length: options.childrenPerClass }, (_, i) => {
      const cause = pick(mix);
      // Some children speak Hindi at home; a language gap only makes sense for a Bhili-home child.
      const homeLanguage = cause !== "language_gap" && rand() < 0.1 ? "hindi" : "bhili";
      const child: Child = { id: id(), classId, rollNo: i + 1, name: `Child ${i + 1}`, homeLanguage, parentChatId: null, parentOptInAt: null, hindiUnderstanding: null };
      return { child, cause };
    });
    const data: ClassData = { children: pupils.map((p) => p.child), checks: [], answers: [], lessons: [], attendance: [], probes: [], listening: [] };
    const foundAt = new Map<string, number>();

    const mark = (pupil: Pupil, conceptId: string, version: Version): Mark => {
      if (rand() < options.blank) return "no_data";
      const right = ability(pupil.cause, conceptId, version);
      return rand() < options.careless ? (right ? "wrong" : "right") : right ? "right" : "wrong";
    };
    const answer = (check: Check, row: number, pupil: Pupil, question: Question): Answer[] =>
      (pupil.child.homeLanguage === "hindi" ? (["A", "B"] as Version[]) : (["A", "B", "C"] as Version[])).map((version) => ({
        checkId: check.id,
        childId: pupil.child.id,
        questionId: question.id,
        row,
        version,
        value: null,
        status: mark(pupil, question.conceptId, version),
        cause: null,
        confidence: null,
        reviewed: true,
      }));
    const present = (date: string, childId: string) =>
      !data.attendance.some((r) => r.date === date && r.childId === childId && !r.present);

    weeks.forEach((week, w) => {
      // Monday to Thursday: the lesson. An "absent" child misses every borrowing lesson.
      for (let weekday = 0; weekday <= 4; weekday++) {
        const date = day(w, weekday);
        if (weekday < 4) {
          const lesson: Lesson = { id: id(), classId, date, conceptId: week.taught, source: "dropdown", transcript: null, page: null };
          data.lessons.push(lesson);
        }
        for (const p of pupils) {
          const missesLesson = p.cause === "absent" && week.taught === "borrowing" && weekday < 4;
          const row: Attendance = { classId, date, childId: p.child.id, present: !(missesLesson || rand() < options.absence) };
          data.attendance.push(row);
        }
      }

      // Friday: the weekly check.
      const friday = day(w, 4);
      const check: Check = {
        id: id(),
        classId,
        date: friday,
        questionIds: week.checked.map((c) => `weekly-${c}`),
        kind: "weekly",
        versionOrder: ["A", "B", "C"],
        childIds: null,
      };
      data.checks.push(check);
      for (const p of pupils) {
        if (!present(friday, p.child.id)) continue;
        check.questionIds.forEach((qid, i) => data.answers.push(...answer(check, i + 1, p, questions.find((q) => q.id === qid)!)));
      }

      // Saturday: a quick re-check for patterns seen once, and the probe for concept gaps.
      const saturday = day(w, 5);
      let all = results(data, content);
      for (const conceptId of week.checked) {
        const records = pupils.map((p) => ({ p, r: childRecord(p.child, data, content, all) }));
        const recheckFor = records.filter(({ r }) => needsRecheck(r.concepts[conceptId].label));
        if (recheckFor.length > 0) {
          const recheck: Check = {
            id: id(),
            classId,
            date: saturday,
            questionIds: [`recheck-${conceptId}`],
            kind: "recheck",
            versionOrder: ["A", "B", "C"],
            childIds: recheckFor.map(({ p }) => p.child.id),
          };
          data.checks.push(recheck);
          for (const { p } of recheckFor) data.answers.push(...answer(recheck, 1, p, questions.find((q) => q.id === recheck.questionIds[0])!));
        }
        for (const { p, r } of records) {
          const label = r.concepts[conceptId].label;
          if (label?.placement !== "taught_not_learned" || label.confirmed) continue;
          // A child who really knows the concept solves it in numbers straight away, unless they slip.
          const passedAtOnce = knows(p.cause, conceptId) && rand() >= options.careless;
          const probe: ProbeResult = {
            id: id(),
            classId,
            childId: p.child.id,
            conceptId,
            date: saturday,
            passedAtOnce,
            restartConceptId: passedAtOnce ? null : r.root(conceptId),
            form: passedAtOnce ? null : "concrete",
          };
          data.probes.push(probe);
        }
        all = results(data, content);
      }

      for (const p of pupils) {
        if (!foundAt.has(p.child.id) && found(p.cause, childRecord(p.child, data, content, all))) foundAt.set(p.child.id, w + 1);
      }
    });

    const all = results(data, content);
    for (const p of pupils) {
      const total = totals.get(p.cause)!;
      const record = childRecord(p.child, data, content, all);
      total.children += 1;
      if (found(p.cause, record)) {
        total.found += 1;
        // A cause can only show once its concept is checked: borrowing first comes up in week 2.
        const start = p.cause === "concept_gap" || p.cause === "absent" ? 2 : 1;
        total.checksToFind.push((foundAt.get(p.child.id) ?? weeks.length) - start + 1);
      }
      if (wrongLabels(p.cause, record)) total.wrongLabel += 1;
    }
  }
  return [...totals.values()];
}

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const percent = (n: number, of: number) => (of === 0 ? "-" : `${Math.round((100 * n) / of)}%`);

export function formatResults(rows: CauseResult[], options: SimulationOptions): string {
  const header = ["Planted cause", "Children", "Found by the last check", "Checks to find (median)", "Given a wrong label"];
  const lines = rows.map((r) => [
    r.cause,
    String(r.children),
    percent(r.found, r.children),
    r.cause === "none" ? "-" : String(median(r.checksToFind)),
    percent(r.wrongLabel, r.children),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  const row = (cells: string[]) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(" | ")} |`;
  return [
    `${options.classes} classes of ${options.childrenPerClass}, ${weeks.length} weekly checks, careless ${options.careless}, blank ${options.blank}, absence ${options.absence}, seed ${options.seed}.`,
    `For "none", found means the child ended with no confirmed gap.`,
    "",
    row(header),
    row(widths.map((w) => "-".repeat(w))),
    ...lines.map(row),
  ].join("\n");
}
