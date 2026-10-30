import { z } from "zod";

// What Claude reads from one photo of slates: one entry per slate, in the order they appear.
// `row` is the concept row on the slate (1 is the top row); `value` is null for an empty box.
// `roll` is null when the roll number can't be read.
export const SlateReading = z.object({
  slates: z.array(
    z.object({
      roll: z.number().int().nullable(),
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
