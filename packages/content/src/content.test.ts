import { describe, expect, it } from "vitest";
import { audioClips, concepts, keywords, questions, stories } from "./index";

const clipIds = new Set(audioClips.map((c) => c.id));
const conceptIds = new Set(concepts.map((c) => c.id));
const keywordIds = new Set(keywords.map((k) => k.id));

describe("content", () => {
  it("parses every file", () => {
    for (const list of [audioClips, concepts, keywords, questions, stories]) {
      expect(list.length).toBeGreaterThan(0);
    }
  });

  it("resolves every audio ref to a manifest entry", () => {
    const refs = [
      ...concepts.map((c) => c.reteachAudio),
      ...keywords.map((k) => k.bhiliAudio),
      ...questions.map((q) => q.B.audio),
    ];
    for (const ref of refs) expect(clipIds).toContain(ref);
  });

  it("resolves every concept and keyword ref", () => {
    for (const c of concepts) for (const p of c.prerequisites) expect(conceptIds).toContain(p);
    for (const q of [...questions, ...stories]) expect(conceptIds).toContain(q.conceptId);
    for (const q of questions) for (const k of q.keywordIds) expect(keywordIds).toContain(k);
  });
});
