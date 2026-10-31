import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { concepts } from "@triveni/content";
import { z } from "zod";

// Turns the transcript of a teacher's voice note into the concept she taught: by the page number if she
// says one, or else by Claude.

// Words Saaras should listen for: the page words and every concept's name.
export const keyterms = ["page", "पेज", "पृष्ठ", ...concepts.flatMap((c) => [c.name, c.nameHi])];

// A page word, then the number: "page 65", "पेज 65", "पृष्ठ संख्या ६५".
const pageNumber = /(?:page|pg|पेज|पृष्ठ|पन्ना)\s*(?:no\.?|number|नंबर|संख्या)?\s*([0-9०-९]+)/i;
const devanagari = "०१२३४५६७८९";

export function findPage(transcript: string): number | null {
  const digits = transcript.match(pageNumber)?.[1];
  if (!digits) return null;
  return Number([...digits].map((d) => (devanagari.includes(d) ? devanagari.indexOf(d) : d)).join(""));
}

export const conceptForPage = (page: number) => concepts.find((c) => c.pages.includes(page))?.id ?? null;

// Each concept with an example sum (its numbers probe step), so Claude can tell neighbouring concepts apart.
const example = (c: (typeof concepts)[number]) => c.probe.find((p) => p.form === "abstract")?.english;

const INSTRUCTIONS = `A teacher in an Indian Class 2 maths class recorded a short voice note saying what she taught today. You get its transcript, which mixes Hindi and English and may have speech-recognition mistakes.

Pick the concept the note is about from the list, by its id. If the note is about none of them, or you can't tell, answer "none". Don't guess between two concepts.
Also give the textbook page number if the note says one, even in words ("पेज बासठ" is 62), or null.

Concepts (id: English name / Hindi name, for example):
${concepts.map((c) => `${c.id}: ${c.name} / ${c.nameHi}, for example ${example(c)}`).join("\n")}`;

const Pick = z.object({ conceptId: z.enum(["none", ...concepts.map((c) => c.id)]), page: z.number().int().nullable() });

let client: Anthropic | undefined;

// The concept a note is about by Claude (or null), and the page it says. Created on first use, so tests run
// without ANTHROPIC_API_KEY.
async function askClaude(transcript: string): Promise<{ conceptId: string | null; page: number | null }> {
  client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    output_config: { effort: "low", format: betaZodOutputFormat(Pick) },
    // On a safety decline, the API retries on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: INSTRUCTIONS,
    messages: [{ role: "user", content: `Transcript: ${transcript}` }],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) {
    throw new Error(`Claude couldn't match the note (${response.stop_reason})`);
  }
  const { conceptId, page } = response.parsed_output;
  return { conceptId: conceptId === "none" ? null : conceptId, page };
}

// The page said in the note, and the concept: by page when the page is in a concept, otherwise by Claude.
// Claude also reads a page said in words; a page it finds that is in a concept decides the concept too.
export async function conceptForNote(transcript: string) {
  const page = findPage(transcript);
  const byPage = page === null ? null : conceptForPage(page);
  if (byPage) return { page, conceptId: byPage, via: "page" as const };
  const read = await askClaude(transcript);
  const heard = page ?? read.page;
  return { page: heard, conceptId: (heard === null ? null : conceptForPage(heard)) ?? read.conceptId, via: "claude" as const };
}
