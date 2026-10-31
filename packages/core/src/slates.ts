import { z } from "zod";

// What Claude reads from one photo of slates: one entry per slate, in the order they appear.
// `row` is the concept row on the slate (1 is the top row); `value` is null for an empty box.
// `rollAsWritten` is the roll copied as written, in its own script ("१२"); `roll` is it as an integer,
// null when it can't be read or isn't there. `name` is a name written on the slate, if any.
export const SlateReading = z.object({
  slates: z.array(
    z.object({
      rollAsWritten: z.string().nullable(),
      roll: z.number().int().nullable(),
      rollConfidence: z.number(),
      name: z.string().nullable(),
      answers: z.array(
        z.object({
          row: z.number().int(),
          version: z.enum(["A", "B", "C"]),
          value: z.number().int().nullable(),
          confidence: z.number(),
        }),
      ),
    }),
  ),
});
export type SlateReading = z.infer<typeof SlateReading>;
export type Slate = SlateReading["slates"][number];

// The class list sent with each photo, so Claude knows the valid rolls and names.
export const Roster = z.array(z.object({ roll: z.number().int().positive(), name: z.string().min(1) }));
export type Roster = z.infer<typeof Roster>;

// From this confidence, a roll in the class places a slate on its own.
export const rollConfident = 0.8;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Whose slate this is, or undefined when that isn't certain. A roll in the class, read with confidence,
// places it; otherwise a name that matches exactly one child. A roll and a name that point to different
// children place nothing.
export function placeSlate<C extends { rollNo: number; name: string }>(roster: C[], slate: Slate): C | undefined {
  const byRoll = slate.roll === null ? undefined : roster.find((c) => c.rollNo === slate.roll);
  const named = slate.name ? roster.filter((c) => sameName(c.name, slate.name!)) : [];
  const byName = named.length === 1 ? named[0] : undefined;
  if (byRoll && byName && byRoll !== byName) return undefined;
  if (byRoll && slate.rollConfidence >= rollConfident) return byRoll;
  return byName;
}
