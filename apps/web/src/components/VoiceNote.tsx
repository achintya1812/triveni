import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { api } from "@/db";

export type NoteResult = { transcript: string; page: number | null; conceptId: string | null; via: "page" | "claude" };

// Sarvam takes notes under 30 seconds.
const maxSeconds = 25;
// webm/Opus where the browser records it (Chrome, Firefox, Android); Safari records mp4.
const mimeType = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

const base64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// Hold to record what was taught today ("borrowing, page 65"), let go to send. The server transcribes it
// and matches it to a concept.
export function VoiceNote({ classId, onResult }: { classId: string; onResult: (result: NoteResult) => void }) {
  const { t } = useTranslation("log");
  const [state, setState] = useState<"idle" | "starting" | "recording" | "sending">("idle");
  const [problem, setProblem] = useState("");
  const held = useRef(false);
  const recorder = useRef<MediaRecorder>(null);

  async function start() {
    held.current = true;
    setProblem("");
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("idle");
      return setProblem(t("voice.noMic"));
    }
    const rec = new MediaRecorder(stream, { mimeType: mimeType() });
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (Date.now() - startedAt < 700) {
        setState("idle");
        return setProblem(t("voice.holdDown"));
      }
      setState("sending");
      try {
        const audio = await base64(new Blob(chunks, { type: rec.mimeType }));
        const res = await api("POST", "/voice-notes", { classId, audio, mimeType: rec.mimeType });
        onResult((await res.json()) as NoteResult);
      } catch (e) {
        setProblem(t("voice.couldNotRead", { error: (e as Error).message }));
      }
      setState("idle");
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
    setTimeout(() => rec.state === "recording" && rec.stop(), maxSeconds * 1000);
    // Let go before the microphone was ready.
    if (!held.current) rec.stop();
  }

  function stop() {
    held.current = false;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  const label = { idle: t("voice.hold"), starting: t("voice.starting"), recording: t("voice.recording"), sending: t("voice.sending") };
  return (
    <div className="space-y-1">
      <Button
        className="h-14 w-full touch-none select-none text-base"
        variant={state === "recording" ? "destructive" : "outline"}
        disabled={state === "sending"}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        🎤 {label[state]}
      </Button>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
    </div>
  );
}
