import { writeFile } from "node:fs/promises";
import { concepts, keywords, kits, listeningItems, questions, stories } from "@triveni/content";

// Writes every content text to one printable page, English, Hindi and Bhili side by side, for the
// people who review the content before it's committed. The page goes to the path given, or
// content-review.html.

type Row = { what: string; english?: string; hindi?: string; bhili?: string; answer?: number | string };

const sections: [string, Row[]][] = [
  [
    "Concepts",
    concepts.flatMap((c): Row[] => [
      { what: "Name", english: c.name, hindi: c.nameHi },
      { what: "Reteaching (played to children)", english: c.reteach.english, bhili: c.reteach.bhili },
      { what: "Parent catch-up", ...c.catchUp },
      ...c.probe.map((p) => ({ what: `Probe, ${p.form}`, english: p.english, hindi: p.hindi, answer: p.answer })),
    ]),
  ],
  [
    "Questions",
    questions.flatMap((q): Row[] => [
      { what: `${q.conceptId}, ${q.use}: A`, english: q.A.prompt, answer: q.A.answer },
      { what: "B (Hindi audio)", english: q.B.english, hindi: q.B.hindi, answer: q.B.answer },
      { what: "C (Bhili audio)", english: q.C.english, hindi: q.C.scriptHi, bhili: q.C.bhili, answer: q.C.answer },
      {
        what: "Likely wrong answers",
        english: (["A", "B", "C"] as const)
          .map((v) => `${v}: ${q.wrongAnswers[v].map((w) => `${w.value} (${w.meaning})`).join("; ")}`)
          .join(" · "),
      },
    ]),
  ],
  ["Key words", keywords.map((k) => ({ what: k.roman, english: k.meaning, hindi: k.hindi, bhili: k.bhili }))],
  ["Practice stories", stories.map((s) => ({ what: s.conceptId, english: s.english, hindi: s.hindi, answer: s.answer }))],
  [
    "Reteaching kit",
    kits.flatMap((kit): Row[] => [
      ...kit.steps.flatMap((s, i) => [
        { what: `Step ${i + 1}: teacher does`, ...s.teacherDoes },
        { what: `Step ${i + 1}: audio says`, ...s.says },
      ]),
      { what: "Home activity", ...kit.parentActivity },
    ]),
  ],
  [
    "Listening check",
    listeningItems.flatMap((l): Row[] => [
      { what: `${l.id}: pictures`, english: l.pictures.map((p) => `${p.number} ${p.emoji} ${p.english}`).join(", ") },
      { what: "Hindi prompt", hindi: l.hindi.text, answer: l.hindi.answer },
      { what: "Bhili prompt", english: l.bhili.english, bhili: l.bhili.text, answer: l.bhili.answer },
    ]),
  ],
];

const esc = (s: string | number = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html = `<!doctype html>
<html lang="hi">
<meta charset="utf-8">
<title>Triveni content review</title>
<style>
  body { font: 15px/1.5 system-ui, "Noto Sans Devanagari", sans-serif; margin: 24px; color: #111; background: #fff; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 32px; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { background: #eee; }
  tr { break-inside: avoid; }
  td:first-child { width: 12%; color: #555; font-size: 13px; }
  td.answer { width: 4%; text-align: center; }
  td.notes { width: 14%; }
</style>
<h1>Triveni content review</h1>
<p>Please check that the Hindi reads naturally for a Class 2 child or a parent, and that every number matches the
English. The Bhili is machine-translated: if you speak Bhili, check it too. Write anything to change in Notes.</p>
${sections
  .map(
    ([title, rows]) => `<h2>${title}</h2>
<table>
<tr><th>What</th><th>English</th><th>Hindi</th><th>Bhili</th><th>Answer</th><th>Notes</th></tr>
${rows
  .map(
    (r) =>
      `<tr><td>${esc(r.what)}</td><td>${esc(r.english)}</td><td>${esc(r.hindi)}</td><td>${esc(r.bhili)}</td>` +
      `<td class="answer">${esc(r.answer)}</td><td class="notes"></td></tr>`,
  )
  .join("\n")}
</table>`,
  )
  .join("\n")}
`;

const out = process.argv[2] ?? "content-review.html";
await writeFile(out, html);
console.log(`Wrote ${out}`);
