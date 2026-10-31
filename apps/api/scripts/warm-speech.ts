import { concepts, keywords, kits, listeningItems, questions } from "@triveni/content";

// Sends every fixed text in the content through POST /speak, so each clip is made and cached before a
// teacher taps play. Run after the content changes, against an API that can reach services/bhili.
// With --check, nothing is made: it lists every text that isn't cached yet, and fails if there are any.
// API_URL picks the API (the deployed one, to check it before a demo).

const api = process.env.API_URL ?? "http://localhost:8787";
const check = process.argv.includes("--check");
const texts: { text: string; language: "bhili" | "hindi" }[] = [
  ...questions.map((q) => ({ text: q.C.bhili, language: "bhili" as const })),
  ...keywords.map((k) => ({ text: k.bhili, language: "bhili" as const })),
  ...concepts.map((c) => ({ text: c.reteach.bhili, language: "bhili" as const })),
  ...keywords.map((k) => ({ text: k.hindi, language: "hindi" as const })),
  // Catch-up lessons, the kit and the listening check, in both languages.
  ...[
    ...concepts.map((c) => c.catchUp),
    ...kits.flatMap((kit) => [...kit.steps.map((s) => s.says), kit.parentActivity]),
    ...listeningItems.map((l) => ({ hindi: l.hindi.text, bhili: l.bhili.text })),
  ].flatMap((t) => [
    { text: t.bhili, language: "bhili" as const },
    { text: t.hindi, language: "hindi" as const },
  ]),
];

let missing = 0;
for (const { text, language } of texts) {
  const started = Date.now();
  const res = await fetch(`${api}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, cachedOnly: check }),
  });
  if (check && res.status === 404) {
    missing += 1;
    console.log(`missing  ${language}  ${text}`);
    continue;
  }
  if (!res.ok) throw new Error(`/speak said ${res.status} for "${text}": ${await res.text()}`);
  if (!check) console.log(`${((Date.now() - started) / 1000).toFixed(0).padStart(3)} s  ${language}  ${text}`);
}
if (check) {
  console.log(missing ? `${missing} of ${texts.length} clips not made yet. Run warm:speech.` : `All ${texts.length} clips are cached.`);
  if (missing) process.exit(1);
}
