import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { type Roster, SlateReading } from "@triveni/core";

let client: Anthropic | undefined;

// Fixed for every photo, so it is cached.
const INSTRUCTIONS = `You read children's answers from photos of slates in an Indian primary school maths check.

Each slate follows the same template, copied from the blackboard:
- The child's roll number, written at the top. Some children write their name instead, or as well.
- One row per maths concept in the check, from top to bottom. Most checks have one row.
- Each row has three boxes, each drawn as a shape: a circle, a triangle and a square. The child writes one whole number inside each box, or leaves it empty.
- The shape tells you the version: circle is A, triangle is B, square is C. Go by the shape, not by where the box is, because children draw the boxes in different orders and sizes.

A photo shows several slates, usually 5 to 8 side by side. It may be tilted, blurred or poorly lit, and the slates may be chalk on black slate or pencil on paper.

Children write numbers in Latin digits (0-9) or in Devanagari digits:
० 0, १ 1, २ 2, ३ 3, ४ 4, ५ 5, ६ 6, ७ 7, ८ 8, ९ 9.
Handwritten Devanagari digits are easy to confuse with each other and with Latin digits. Tell them apart by their strokes:
- १ (one): a small open hook at the top, then one long tail sweeping down, often to the right. No closed loop and no base. It looks like a Latin 9 or like २ without its base.
- २ (two): a hook at the top, then a stroke that turns and runs along the bottom to the right, like a Latin 2. The base is what makes it २ and not १.
- ३ (three): like २ with a second bump on the right, like a Latin 3 with a tail.
- ४ (four): a loop crossed by a stroke, like a Latin 8 or a looped y.
- ५ (five): a hook with a small loop at the bottom, like a u with a tail. It can look like a Latin 4 or 5.
- ६ (six): like a Latin ε or a backwards 3, with a small tail at the bottom right.
- ७ (seven): a v or u shape with a curl, like a Latin 6 or 9 turned on its side.
- ८ (eight): one open curve with a hook at the top, like a Latin C, L or <.
- ९ (nine): a closed or nearly closed loop at the top with a tail going down, like a Latin 9 or ρ. The closed loop is what makes it ९ and not १.
- ० (zero): a small circle.
Read each Devanagari digit stroke by stroke, and look at the other digits on the same slate to learn how this child writes. If a digit could be either of two look-alikes, give that value a low confidence.
Each slate is written in one script: if any number on a slate is clearly Devanagari, read every number on that slate, the roll included, as Devanagari.

Return one entry per slate, in the order they appear: left to right, then top to bottom.
- rollAsWritten: the roll number copied exactly as written, in its own script (for example "१२" or "12"). Use ? for a digit you can't make out. null if no roll is written.
- roll: rollAsWritten as an integer, or null if you can't read it.
- rollConfidence: your probability, from 0 to 1, that roll is exactly right.
- name: the name written on the slate, in Devanagari or Latin letters, or null if there is none. If it is clearly the name of one child in the class list, return that name exactly as the list spells it; otherwise copy it as written.
- answers: one entry per box, with row (1 for the top row), version (A, B or C), value (the integer written in the box, or null if the box is empty) and confidence.

The message lists the class: each child's roll number and name. Use it to read names, but never change a roll to fit it. A roll that isn't in the list was probably misread, so give it a low rollConfidence. Two slates with the same roll means at least one is misread.

confidence and rollConfidence are your probability, from 0 to 1, that the value is exactly right. Give less than 0.8 whenever the writing is unclear, a digit could be another digit (1 and 7, 4 and 9, 5 and 6, 0 and 6, or the Devanagari look-alikes above), the box is partly hidden, or you aren't sure of its shape. A wrong value given with high confidence is worse than a low-confidence one, because the teacher only checks the low-confidence ones.

Leave out slates that are mostly cut off at the edge of the photo. The teacher will photograph them again.`;

export type Effort = "low" | "medium";

// Reads every slate in one photo. Created on first use, so tests run without ANTHROPIC_API_KEY.
// The class list and row count go in the message, so the instructions stay the same (and cached) for every class.
export async function readSlates(
  image: string,
  mediaType: "image/jpeg" | "image/png",
  roster: Roster,
  rows: number,
  effort: Effort = "low",
) {
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort, format: betaZodOutputFormat(SlateReading) },
    // On a safety decline, the API retries on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: INSTRUCTIONS, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          {
            type: "text",
            text:
              `Each slate has ${rows} ${rows === 1 ? "row" : "rows"}. The class:\n` +
              roster.map((c) => `${c.roll}: ${c.name}`).join("\n") +
              "\n\nRead every slate in this photo.",
          },
        ],
      },
    ],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) {
    throw new Error(`Claude couldn't read the photo (${response.stop_reason})`);
  }
  return response.parsed_output;
}
