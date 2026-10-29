import { z } from "zod";

export const Language = z.enum(["hindi", "bhili"]);
export type Language = z.infer<typeof Language>;

// Pre-made clips: only the Hindi B questions now. Bhili is spoken live from text (POST /speak).
// `file` is absent until the clip has been made.
export const AudioClip = z.object({
  id: z.string(),
  kind: z.enum(["check_b", "check_c", "keyword", "reteach"]),
  language: Language,
  source: z.enum(["human", "bulbul"]),
  file: z.string().optional(),
});
export type AudioClip = z.infer<typeof AudioClip>;

export const Concept = z.object({
  id: z.string(),
  name: z.string(),
  prerequisites: z.array(z.string()),
  // Played to children who were taught the concept but didn't learn it, while the teacher uses real objects.
  // `bhili` is spoken live; services/bhili/translate.py makes it from `english`.
  reteach: z.object({ english: z.string(), bhili: z.string() }),
});
export type Concept = z.infer<typeof Concept>;

export const Keyword = z.object({
  id: z.string(),
  hindi: z.string(),
  roman: z.string(),
  meaning: z.string(),
  // Spoken live; services/bhili/translate.py makes it from `meaning`.
  bhili: z.string(),
});
export type Keyword = z.infer<typeof Keyword>;

// One question asked three ways, each with its own numbers.
// C is spoken live from `bhili` (Devanagari), which services/bhili/translate.py makes from `english`.
export const Question = z.object({
  id: z.string(),
  conceptId: z.string(),
  keywordIds: z.array(z.string()),
  A: z.object({ prompt: z.string(), answer: z.number().int() }),
  B: z.object({ hindi: z.string(), english: z.string(), answer: z.number().int(), audio: z.string() }),
  C: z.object({ scriptHi: z.string(), bhili: z.string(), english: z.string(), answer: z.number().int() }),
});
export type Question = z.infer<typeof Question>;

export const PracticeStory = z.object({
  id: z.string(),
  conceptId: z.string(),
  hindi: z.string(),
  english: z.string(),
  answer: z.number().int(),
});
export type PracticeStory = z.infer<typeof PracticeStory>;
