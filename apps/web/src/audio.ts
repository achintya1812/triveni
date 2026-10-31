import type { AudioClip } from "@triveni/core";
import { api, isNetworkError } from "./db";
import i18n from "./i18n";

// Why a clip can't play, or undefined if it can.
export function clipProblem(clip: AudioClip | undefined): string | undefined {
  if (!clip?.file) return i18n.t("audio.clipNotMade");
}

// `file` is the path in the public Supabase Storage bucket `audio`.
export const clipUrl = (file: string) => `${import.meta.env.VITE_AUDIO_BASE_URL}${file}`;

// Text spoken by the API: Bhili by services/bhili, Hindi by Bulbul. The API caches each clip, so only the
// first time is slow. The deployed API has no Bhili speech service, so Bhili must have been made beforehand.
// With no signal, the clip's address is worked out here instead, and the service worker plays it if it's cached.
export async function speak(text: string, language: "bhili" | "hindi" = "bhili") {
  try {
    const { file } = (await (await api("POST", "/speak", { text, language })).json()) as { file: string };
    return clipUrl(file);
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    return clipUrl(await speechFile(text, language));
  }
}

// Where the API caches a text's speech: the same path it computes (apps/api/src/routes/speak.ts).
export async function speechFile(text: string, language: "bhili" | "hindi") {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `tts/${language}/${hex}.${language === "bhili" ? "wav" : "mp3"}`;
}

// Fetches clips while there's a signal, so the service worker has them for later. Failures are fine:
// the clip is fetched again when it's played.
export async function cacheAudio(urls: string[]) {
  await Promise.allSettled(urls.map((url) => fetch(url)));
}

// What to tell the teacher when speech can't be had.
export function speechProblem(e: Error & { status?: number }, language: "bhili" | "hindi") {
  if (e.status === 503) return i18n.t("audio.bhiliNotMade");
  return i18n.t("audio.speechFailed", { language: i18n.t(`languages.${language}`), error: e.message });
}
