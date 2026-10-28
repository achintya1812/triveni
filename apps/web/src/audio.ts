import type { AudioClip } from "@triveni/core";

// Children are only checked on human recordings. Bulbul stand-ins play only when
// VITE_DEV_ALLOW_STANDINS=true, which is off in every build used with children.
export const allowStandins = import.meta.env.VITE_DEV_ALLOW_STANDINS === "true";

// Why a clip can't play, or undefined if it can.
export function clipProblem(clip: AudioClip | undefined, allowStandins: boolean): string | undefined {
  if (!clip?.file) return "This clip has not been recorded yet.";
  if (clip.source !== "human" && !allowStandins) {
    return "This clip is a computer-voice stand-in, not a human recording, so it can't be used in a check.";
  }
}

// `file` is the path in the public Supabase Storage bucket `audio`.
export const clipUrl = (clip: AudioClip) => `${import.meta.env.VITE_AUDIO_BASE_URL}${clip.file}`;
