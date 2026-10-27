import { z } from "zod";

export const Language = z.enum(["hindi", "bhili"]);
export type Language = z.infer<typeof Language>;

// Clips a child is checked on, and anything in Bhili, must be source "human".
// `file` is absent until the clip has been recorded.
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
  reteachAudio: z.string(),
});
export type Concept = z.infer<typeof Concept>;

export const Keyword = z.object({
  id: z.string(),
  hindi: z.string(),
  roman: z.string(),
  meaning: z.string(),
  bhiliAudio: z.string(),
});
export type Keyword = z.infer<typeof Keyword>;

// One question asked three ways, each with its own numbers.
// C has no Bhili text: the speaker translates `scriptHi` when recording.
export const Question = z.object({
  id: z.string(),
  conceptId: z.string(),
  keywordIds: z.array(z.string()),
  A: z.object({ prompt: z.string(), answer: z.number().int() }),
  B: z.object({ hindi: z.string(), english: z.string(), answer: z.number().int(), audio: z.string() }),
  C: z.object({ scriptHi: z.string(), english: z.string(), answer: z.number().int(), audio: z.string() }),
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
