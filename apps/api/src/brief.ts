import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

const INSTRUCTIONS = `You reword a morning brief for a Grade 1-3 teacher in a Hindi-medium government school in India. Many of the children speak Bhili at home.
Rewrite it in plain, warm English that she can read in under a minute on her phone.
Keep every child in the same group, and keep each group's action. Do not add children, groups, advice or numbers that are not in the brief.
Refer to children by name or as "they", never as he or she: the brief does not say a child's gender.
Write plain text: no markdown, no headings, and no list markers other than "-".`;

// Rewords the template brief from @triveni/core. The phone keeps showing the template if this fails.
// Created on first use, so tests that never call it run without ANTHROPIC_API_KEY.
export async function rewordBrief(brief: string) {
  client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "low" },
    // On a safety decline, the API retries on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: INSTRUCTIONS,
    messages: [{ role: "user", content: brief }],
  });
  if (response.stop_reason !== "end_turn") throw new Error(`Claude stopped with ${response.stop_reason}`);
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("").trim();
  if (!text) throw new Error("Claude returned no text");
  return text;
}
