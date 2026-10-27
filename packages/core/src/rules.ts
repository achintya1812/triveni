import type { Language, Question } from "./content";

export type Mark = "right" | "wrong" | "no_data";

export type PatternGroup = "ready" | "language_gap" | "word_problem_gap" | "concept_gap" | "unclear";

// Where a child lands after one check. Concept gap is split by attendance.
export type Placement = Exclude<PatternGroup, "concept_gap"> | "never_taught" | "taught_not_learned";

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

// A blank box is no data, not a wrong answer.
export function markAnswer(value: number | null, correct: number): Mark {
  if (value === null) return "no_data";
  return value === correct ? "right" : "wrong";
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
    case "rwr":
      return "language_gap";
    case "rww":
    case "rw":
      return "word_problem_gap";
    case "www":
    case "ww":
      return "concept_gap";
    default:
      return "unclear";
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

export function placeChild(
  answers: ChildAnswers,
  question: Question,
  lessons: LessonLog[],
  attendance: AttendanceLog[],
): Placement {
  const a = markAnswer(answers.a, question.A.answer);
  const b = markAnswer(answers.b, question.B.answer);
  const c = answers.homeLanguage === "hindi" ? null : markAnswer(answers.c, question.C.answer);
  const group = patternGroup(a, b, c);
  if (group !== "concept_gap") return group;
  return wasTaught(answers.childId, question.conceptId, lessons, attendance)
    ? "taught_not_learned"
    : "never_taught";
}
