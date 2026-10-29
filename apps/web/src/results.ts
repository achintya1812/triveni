import {
  type Answer,
  type AttendanceLog,
  type Child,
  type LessonLog,
  type Placement,
  placeChild,
  type Question,
} from "@triveni/core";
import type { Version } from "./check";

export type Placed = { child: Child; placement: Placement };

// The order groups are shown in, matching the brief: the children who need help first.
export const groupOrder: Placement[] = [
  "language_gap",
  "word_problem_gap",
  "never_taught",
  "taught_not_learned",
  "unclear",
  "ready",
];

// Places each child who has answers in the check. The grid stores every box, blanks included.
export function placeChildren(
  question: Question,
  children: Child[],
  answers: Answer[],
  lessons: LessonLog[],
  attendance: AttendanceLog[],
): Placed[] {
  return children.flatMap((child) => {
    const mine = answers.filter((a) => a.childId === child.id);
    if (mine.length === 0) return [];
    const value = (version: Version) => mine.find((a) => a.version === version)?.value ?? null;
    const childAnswers = {
      childId: child.id,
      homeLanguage: child.homeLanguage,
      a: value("A"),
      b: value("B"),
      c: value("C"),
    };
    return [{ child, placement: placeChild(childAnswers, question, lessons, attendance) }];
  });
}
