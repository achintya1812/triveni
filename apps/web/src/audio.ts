import type { AudioClip } from "@triveni/core";
import { api } from "./db";

// Why a clip can't play, or undefined if it can.
export function clipProblem(clip: AudioClip | undefined): string | undefined {
  if (!clip?.file) return "This clip has not been made yet.";
}

// `file` is the path in the public Supabase Storage bucket `audio`.
export const clipUrl = (file: string) => `${import.meta.env.VITE_AUDIO_BASE_URL}${file}`;

// Bhili text spoken live by services/bhili. The API caches it, so only the first time is slow.
export async function speak(text: string) {
  const { file } = (await (await api("POST", "/speak", { text })).json()) as { file: string };
  return clipUrl(file);
}
