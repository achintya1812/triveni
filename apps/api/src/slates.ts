import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { SlateReading } from "@triveni/core";

let client: Anthropic | undefined;

// Fixed for every photo, so it is cached.
const INSTRUCTIONS = `You read children's answers from photos of slates in an Indian primary school maths check.

Each slate follows the same template, copied from the blackboard:
- The child's roll number, written at the top.
- One row per maths concept in the check, from top to bottom. Most checks have one row.
- Each row has three boxes, each drawn as a shape: a circle, a triangle and a square. The child writes one whole number inside each box, or leaves it empty.
- The shape tells you the version: circle is A, triangle is B, square is C. Go by the shape, not by where the box is, because children draw the boxes in different orders and sizes.

A photo shows several slates, usually 5 to 8 side by side. It may be tilted, blurred or poorly lit, and the slates may be chalk on black slate or pencil on paper.

Return one entry per slate, in the order they appear: left to right, then top to bottom.
- roll: the roll number as an integer, or null if you can't read it.
- answers: one entry per box, with row (1 for the top row), version (A, B or C), value (the integer written in the box, or null if the box is empty) and confidence.

confidence is your probability, from 0 to 1, that value is exactly right. Give less than 0.8 whenever the writing is unclear, a digit could be another digit (1 and 7, 4 and 9, 5 and 6, 0 and 6), the box is partly hidden, or you aren't sure of its shape. A wrong value given with high confidence is worse than a low-confidence one, because the teacher only checks the low-confidence boxes. Children may write Devanagari digits (०१२३४५६७८९); return them as ordinary integers.

Leave out slates that are mostly cut off at the edge of the photo. The teacher will photograph them again.`;

// Reads every slate in one photo. Created on first use, so tests run without ANTHROPIC_API_KEY.
export async function readSlates(image: string, mediaType: "image/jpeg" | "image/png") {
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: betaZodOutputFormat(SlateReading) },
    // On a safety decline, the API retries on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: INSTRUCTIONS, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: "Read every slate in this photo." },
        ],
      },
    ],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) {
    throw new Error(`Claude couldn't read the photo (${response.stop_reason})`);
  }
  return response.parsed_output;
}
