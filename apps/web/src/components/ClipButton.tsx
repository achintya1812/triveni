import { audioClips } from "@triveni/content";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { clipProblem, clipUrl, speak } from "@/audio";

// Plays one clip from the manifest, or says why it won't.
export function ClipButton({ clipId, label }: { clipId: string; label: string }) {
  const clip = audioClips.find((c) => c.id === clipId);
  const problem = clipProblem(clip);
  return <PlayButton url={problem ? undefined : clipUrl(clip!.file!)} problem={problem} label={label} />;
}

// Speaks Bhili text live. Asks for the audio as soon as it shows, because the first time can take a minute.
export function SpeakButton({ text, label }: { text: string; label: string }) {
  const [url, setUrl] = useState<string>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    let current = true;
    setUrl(undefined);
    setProblem(undefined);
    speak(text).then(
      (u) => current && setUrl(u),
      (e: Error) => current && setProblem(`Could not make the Bhili audio: ${e.message}`),
    );
    return () => {
      current = false;
    };
  }, [text]);

  return <PlayButton url={url} problem={problem} label={url || problem ? label : "Preparing Bhili audio…"} />;
}

function PlayButton({ url, problem, label }: { url?: string; problem?: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  function play() {
    const audio = new Audio(url);
    const fail = (message: string) => {
      setPlaying(false);
      setError(`Could not play the clip: ${message}`);
    };
    audio.onended = () => setPlaying(false);
    // A missing or broken file shows up here.
    audio.onerror = () => fail(audio.error?.message || "the file could not be loaded");
    setError("");
    setPlaying(true);
    // Firefox can reject play() with an AbortError when it restarts the download, yet still plays the clip.
    audio.play().catch((e: Error) => e.name !== "AbortError" && fail(e.message));
  }

  return (
    <div className="space-y-1">
      <Button className="h-14 w-full text-base" disabled={!url || playing} onClick={play}>
        {playing ? "Playing…" : label}
      </Button>
      {(problem || error) && <p className="text-sm text-destructive">{problem ?? error}</p>}
    </div>
  );
}
