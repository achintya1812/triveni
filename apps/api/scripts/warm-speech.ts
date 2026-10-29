import { concepts, keywords, questions } from "@triveni/content";

// Sends every Bhili text in the content through POST /speak, so each clip is made and cached
// before a teacher taps play. Run after the content changes, with the API and services/bhili running.

const api = process.env.API_URL ?? "http://localhost:8787";
const texts = [
  ...questions.map((q) => q.C.bhili),
  ...keywords.map((k) => k.bhili),
  ...concepts.map((c) => c.reteach.bhili),
];

for (const text of texts) {
  const started = Date.now();
  const res = await fetch(`${api}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`/speak said ${res.status} for "${text}"`);
  console.log(`${((Date.now() - started) / 1000).toFixed(0).padStart(3)} s  ${text}`);
}
