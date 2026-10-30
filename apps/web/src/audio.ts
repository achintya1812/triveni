import type { AudioClip } from "@triveni/core";
import { api } from "./db";

// Why a clip can't play, or undefined if it can.
export function clipProblem(clip: AudioClip | undefined): string | undefined {
  if (!clip?.file) return "This clip has not been made yet.";
}

// `file` is the path in the public Supabase Storage bucket `audio`.
export const clipUrl = (file: string) => `${import.meta.env.VITE_AUDIO_BASE_URL}${file}`;

// Text spoken by the API: Bhili by services/bhili, Hindi by Bulbul. The API caches each clip, so only the
// first time is slow. The deployed API has no Bhili speech service, so Bhili must have been made beforehand.
export async function speak(text: string, language: "bhili" | "hindi" = "bhili") {
  const { file } = (await (await api("POST", "/speak", { text, language })).json()) as { file: string };
  return clipUrl(file);
}

// What to tell the teacher when speech can't be had.
export function speechProblem(e: Error & { status?: number }, language: "bhili" | "hindi") {
  if (e.status === 503) return "This Bhili clip hasn't been made yet. Ask whoever runs the app to make the Bhili audio.";
  return `Could not make the ${language === "bhili" ? "Bhili" : "Hindi"} audio: ${e.message}`;
}
