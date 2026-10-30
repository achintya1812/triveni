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

// Text in the three languages; `bhili` is made from `english` by services/bhili/translate.py.
const Trilingual = z.object({ english: z.string(), hindi: z.string(), bhili: z.string() });

export const ProbeForm = z.enum(["concrete", "pictorial", "abstract"]);
export type ProbeForm = z.infer<typeof ProbeForm>;

// One step of the step-down probe. It's oral, in the teacher's language, so there is no Bhili.
export const ProbeStep = z.object({
  form: ProbeForm,
  english: z.string(),
  hindi: z.string(),
  answer: z.number().int(),
});
export type ProbeStep = z.infer<typeof ProbeStep>;

// The full-build fields are optional until Stage 19 fills them in.
export const Concept = z.object({
  id: z.string(),
  name: z.string(),
  nameHi: z.string().optional(),
  prerequisites: z.array(z.string()),
  // Textbook pages, for matching the teacher's voice note to a concept.
  pages: z.array(z.number().int().positive()).default([]),
  // Played to children who were taught the concept but didn't learn it, while the teacher uses real objects.
  // `bhili` is spoken live; services/bhili/translate.py makes it from `english`.
  reteach: z.object({ english: z.string(), bhili: z.string() }),
  // The parent's catch-up lesson, with a household activity, for a child who missed the concept.
  catchUp: Trilingual.optional(),
  probe: z.array(ProbeStep).default([]),
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

// A likely wrong answer and what it shows. `pointsTo` says where the trouble is: a key word
// (such as the direction word), a concept (`conceptId`), or nothing to go on (`no_data`).
export const WrongAnswer = z.object({
  value: z.number().int(),
  cause: z.string(),
  meaning: z.string(),
  pointsTo: z.enum(["keyword", "concept", "no_data"]),
  conceptId: z.string().optional(),
});
export type WrongAnswer = z.infer<typeof WrongAnswer>;

// One question asked three ways, each with its own numbers.
// C is spoken live from `bhili` (Devanagari), which services/bhili/translate.py makes from `english`.
export const Question = z.object({
  id: z.string(),
  conceptId: z.string(),
  keywordIds: z.array(z.string()),
  A: z.object({ prompt: z.string(), answer: z.number().int() }),
  B: z.object({ hindi: z.string(), english: z.string(), answer: z.number().int(), audio: z.string() }),
  C: z.object({ scriptHi: z.string(), bhili: z.string(), english: z.string(), answer: z.number().int() }),
  // A weekly check and a quick re-check use different questions, so the numbers are fresh.
  use: z.enum(["weekly", "recheck"]).default("weekly"),
  wrongAnswers: z
    .object({ A: z.array(WrongAnswer), B: z.array(WrongAnswer), C: z.array(WrongAnswer) })
    .default({ A: [], B: [], C: [] }),
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

// The reteaching kit for one gap: paired steps (what the teacher does, what the audio says),
// the key-word card and a home activity for parents.
export const Kit = z.object({
  id: z.string(),
  conceptId: z.string(),
  steps: z.array(z.object({ teacherDoes: z.object({ english: z.string(), hindi: z.string() }), says: Trilingual })),
  keywordIds: z.array(z.string()),
  parentActivity: Trilingual,
});
export type Kit = z.infer<typeof Kit>;

// One item of the listening check: four numbered pictures, and a prompt in each language asking for
// a different picture, so a child can't copy the first answer.
export const ListeningItem = z.object({
  id: z.string(),
  pictures: z.array(z.object({ number: z.number().int().min(1).max(4), emoji: z.string(), english: z.string() })).length(4),
  hindi: z.object({ text: z.string(), answer: z.number().int().min(1).max(4) }),
  bhili: z.object({ text: z.string(), english: z.string(), answer: z.number().int().min(1).max(4) }),
});
export type ListeningItem = z.infer<typeof ListeningItem>;
