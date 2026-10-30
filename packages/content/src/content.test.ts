import { describe, expect, it } from "vitest";
import { audioClips, concepts, keywords, kits, questions, stories } from "./index";

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
    for (const ref of questions.map((q) => q.B.audio)) expect(clipIds).toContain(ref);
  });

  it("resolves every concept and keyword ref", () => {
    for (const c of concepts) for (const p of c.prerequisites) expect(conceptIds).toContain(p);
    for (const q of [...questions, ...stories]) expect(conceptIds).toContain(q.conceptId);
    for (const q of questions) for (const k of q.keywordIds) expect(keywordIds).toContain(k);
    for (const kit of kits) {
      expect(conceptIds).toContain(kit.conceptId);
      for (const k of kit.keywordIds) expect(keywordIds).toContain(k);
    }
    for (const q of questions) {
      for (const w of [...q.wrongAnswers.A, ...q.wrongAnswers.B, ...q.wrongAnswers.C]) {
        if (w.conceptId) expect(conceptIds).toContain(w.conceptId);
      }
    }
  });
});
