import { type Answer, type Child, markAnswer, type Question } from "@triveni/core";

export type Version = Answer["version"];

// What the teacher typed in each box: digits, or "" for a blank. Stage 7 fills this from slate photos.
export type GridValues = Record<string, Partial<Record<Version, string>>>;

// Children whose home language is Hindi have no C: B already asks them in their own language.
export const versionsFor = (child: Child): Version[] =>
  child.homeLanguage === "hindi" ? ["A", "B"] : ["A", "B", "C"];

// One answer per box, blanks included, so a blank is stored as no_data rather than missing.
export function markGrid(checkId: string, question: Question, children: Child[], values: GridValues): Answer[] {
  return children.flatMap((child) =>
    versionsFor(child).map((version) => {
      const raw = values[child.id]?.[version] ?? "";
      const value = raw === "" ? null : Number(raw);
      return {
        checkId,
        childId: child.id,
        questionId: question.id,
        version,
        value,
        status: markAnswer(value, question[version].answer),
      };
    }),
  );
}
