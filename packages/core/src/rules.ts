import type { Concept, Language, Question } from "./content";
import type { Version } from "./records";

export type Mark = "right" | "wrong" | "no_data";

// The eight answer patterns from IDEA.md, plus `unclear` when any box has no data.
export type PatternGroup =
  | "ready"
  | "concept_gap"
  | "language_gap"
  | "word_problem_gap"
  | "symbol_gap"
  | "clip_failed"
  | "language_symbol_gap"
  | "inconsistent"
  | "unclear";

// Where a child lands after one check. Concept gap is split by attendance;
// a child absent on the check day who was taught the concept is `not_checked`.
export type Placement =
  | Exclude<PatternGroup, "concept_gap">
  | "never_taught"
  | "taught_not_learned"
  | "not_checked";

export interface LessonLog {
  date: string;
  conceptId: string;
}

export interface AttendanceLog {
  date: string;
  childId: string;
  present: boolean;
}

export interface ChildAnswers {
  childId: string;
  homeLanguage: Language;
  a: number | null;
  b: number | null;
  c: number | null;
}

// `cause` is the matched wrong answer's cause, or `copied` for a number taken from the question.
export interface Marked {
  status: Mark;
  cause: string | null;
}

const numbersIn = (text: string) => (text.match(/\d+/g) ?? []).map(Number);

// A blank box, or a number copied from the question, is no data, not a wrong answer.
// A wrong answer in the question's list carries its cause; one whose list entry points to
// no_data counts as no data too.
export function markAnswer(value: number | null, question: Question, version: Version): Marked {
  if (value === null) return { status: "no_data", cause: null };
  if (value === question[version].answer) return { status: "right", cause: null };
  const listed = question.wrongAnswers[version].find((w) => w.value === value);
  if (listed) return { status: listed.pointsTo === "no_data" ? "no_data" : "wrong", cause: listed.cause };
  const text = version === "A" ? question.A.prompt : question[version].english;
  if (numbersIn(text).includes(value)) return { status: "no_data", cause: "copied" };
  return { status: "wrong", cause: null };
}

// `c` is null for children whose home language is Hindi: B already covers it,
// so A right and B wrong is a word-problem gap, never a language gap.
export function patternGroup(a: Mark, b: Mark, c: Mark | null): PatternGroup {
  if (a === "no_data" || b === "no_data" || c === "no_data") return "unclear";
  const key = `${a[0]}${b[0]}${c === null ? "" : c[0]}`;
  switch (key) {
    case "rrr":
    case "rr":
      return "ready";
    case "www":
    case "ww":
      return "concept_gap";
    case "rwr":
      return "language_gap";
    case "rww":
    case "rw":
      return "word_problem_gap";
    case "wrr":
    case "wr":
      return "symbol_gap";
    case "rrw":
      return "clip_failed";
    case "wwr":
      return "language_symbol_gap";
    default: // wrw
      return "inconsistent";
  }
}

// Never taught means absent on every day the concept was taught.
// A child with no attendance row for a day counts as present (the default).
// With no logged lesson there is no evidence of absence, so the child counts as taught.
export function wasTaught(
  childId: string,
  conceptId: string,
  lessons: LessonLog[],
  attendance: AttendanceLog[],
): boolean {
  const dates = lessons.filter((l) => l.conceptId === conceptId).map((l) => l.date);
  if (dates.length === 0) return true;
  return dates.some(
    (date) => !attendance.some((r) => r.date === date && r.childId === childId && !r.present),
  );
}

// One row (concept) of a check. A child absent on the check day is never marked wrong.
export function placeChild(
  answers: ChildAnswers,
  question: Question,
  lessons: LessonLog[],
  attendance: AttendanceLog[],
  checkDate: string,
): Placement {
  const marks = {
    a: markAnswer(answers.a, question, "A").status,
    b: markAnswer(answers.b, question, "B").status,
    c: answers.homeLanguage === "hindi" ? null : markAnswer(answers.c, question, "C").status,
  };
  return placeMarks(answers.childId, question.conceptId, marks, lessons, attendance, checkDate);
}

// The same, from marks already made: stored answers, or a re-check the teacher marked by tap.
export function placeMarks(
  childId: string,
  conceptId: string,
  marks: { a: Mark; b: Mark; c: Mark | null },
  lessons: LessonLog[],
  attendance: AttendanceLog[],
  checkDate: string,
): Placement {
  const taught = wasTaught(childId, conceptId, lessons, attendance);
  const absentToday = attendance.some((r) => r.date === checkDate && r.childId === childId && !r.present);
  if (absentToday) return taught ? "not_checked" : "never_taught";
  const group = patternGroup(marks.a, marks.b, marks.c);
  if (group !== "concept_gap") return group;
  return taught ? "taught_not_learned" : "never_taught";
}

// "Same pattern twice": one bad day shouldn't label a child.

export interface PlacementLog {
  childId: string;
  conceptId: string;
  date: string;
  placement: Placement;
}

export interface ProbeLog {
  childId: string;
  conceptId: string;
  date: string;
  passedAtOnce: boolean;
}

export interface Label {
  placement: Placement;
  confirmed: boolean;
}

// Ready and never taught need no second look; these are never a group (the next check decides).
const needsNoConfirmation: Placement[] = ["ready", "never_taught"];
const neverAGroup: Placement[] = ["inconsistent", "unclear", "not_checked"];

// The label a child carries for a concept, from their latest result, or null for no label.
// `placements` and `probes` may hold every child and concept; same-day results keep their order.
// A label is confirmed by the same placement on the child's previous result for the concept;
// a language gap also by a language gap in another ISO week, on any concept (it belongs to the child);
// taught-but-not-learned also by a probe the child didn't pass at once.
// A probe passed at once clears the label: the child had a bad day and goes back to the class.
export function labelFor(
  childId: string,
  conceptId: string,
  placements: PlacementLog[],
  probes: ProbeLog[],
): Label | null {
  const mine = placements.filter((p) => p.childId === childId);
  const history = mine
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.conceptId === conceptId)
    .sort((x, y) => x.p.date.localeCompare(y.p.date) || x.i - y.i)
    .map(({ p }) => p);
  const latest = history.at(-1);
  if (!latest) return null;
  const { placement } = latest;

  const probe = probes
    .filter((p) => p.childId === childId && p.conceptId === conceptId && p.date >= latest.date)
    .sort((x, y) => x.date.localeCompare(y.date))
    .at(-1);
  if (placement === "taught_not_learned" && probe?.passedAtOnce) return null;

  if (needsNoConfirmation.includes(placement)) return { placement, confirmed: true };
  if (neverAGroup.includes(placement)) return { placement, confirmed: false };

  const confirmed =
    history.at(-2)?.placement === placement ||
    (placement === "language_gap" &&
      mine.some((p) => p.placement === "language_gap" && isoWeek(p.date) !== isoWeek(latest.date))) ||
    (placement === "taught_not_learned" && probe?.passedAtOnce === false);
  return { placement, confirmed };
}

// Unconfirmed children get a quick re-check the next day; taught-but-not-learned gets the probe instead.
export function needsRecheck(label: Label | null): boolean {
  return (
    !!label &&
    !label.confirmed &&
    !neverAGroup.includes(label.placement) &&
    label.placement !== "taught_not_learned"
  );
}

// ISO week as "YYYY-Www", from a YYYY-MM-DD date.
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday of this week decides its year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// The order the versions are asked in rotates each week, so no version always benefits from coming last.
const orders: Version[][] = [
  ["A", "B", "C"],
  ["B", "C", "A"],
  ["C", "A", "B"],
];

export function versionOrder(date: string): Version[] {
  return orders[Number(isoWeek(date).split("-W")[1]) % 3];
}

// At most two concepts taught since the last weekly check (`since`, or null for none yet):
// those that most other concepts depend on (directly or not) first, then the most recently taught.
export function pickConcepts(lessons: LessonLog[], concepts: Concept[], since: string | null): string[] {
  const recent = lessons.filter((l) => since === null || l.date > since);
  const lastTaught = new Map<string, string>();
  for (const l of recent) {
    if ((lastTaught.get(l.conceptId) ?? "") < l.date) lastTaught.set(l.conceptId, l.date);
  }
  return [...lastTaught.keys()]
    .sort(
      (x, y) =>
        dependents(y, concepts) - dependents(x, concepts) || lastTaught.get(y)!.localeCompare(lastTaught.get(x)!),
    )
    .slice(0, 2);
}

function dependents(conceptId: string, concepts: Concept[]): number {
  const found = new Set<string>();
  const visit = (id: string) => {
    for (const c of concepts) {
      if (c.prerequisites.includes(id) && !found.has(c.id)) {
        found.add(c.id);
        visit(c.id);
      }
    }
  };
  visit(conceptId);
  return found.size;
}
