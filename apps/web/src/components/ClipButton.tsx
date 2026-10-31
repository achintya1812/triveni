import { audioClips } from "@triveni/content";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { clipProblem, clipUrl, speak, speechProblem } from "@/audio";

// Plays one clip from the manifest, or says why it won't.
export function ClipButton({ clipId, label }: { clipId: string; label: string }) {
  const clip = audioClips.find((c) => c.id === clipId);
  const problem = clipProblem(clip);
  return <PlayButton url={problem ? undefined : clipUrl(clip!.file!)} problem={problem} label={label} />;
}

// Speaks text (Bhili by default). Asks for the audio as soon as it shows, because the first time can take a minute.
export function SpeakButton({ text, label, language = "bhili" }: { text: string; label: string; language?: "bhili" | "hindi" }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    let current = true;
    setUrl(undefined);
    setProblem(undefined);
    speak(text, language).then(
      (u) => current && setUrl(u),
      (e: Error) => current && setProblem(speechProblem(e, language)),
    );
    return () => {
      current = false;
    };
  }, [text, language]);

  return <PlayButton url={url} problem={problem} label={url || problem ? label : t("audio.preparing")} />;
}

// Reads text aloud in Hindi, asking for the audio only when tapped (the brief changes every day).
export function ReadAloud({ text }: { text: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "preparing" | "playing">("idle");
  const [problem, setProblem] = useState("");

  async function read() {
    setProblem("");
    setState("preparing");
    try {
      const audio = new Audio(await speak(text, "hindi"));
      audio.onended = () => setState("idle");
      audio.onerror = () => {
        setState("idle");
        setProblem(t("audio.couldNotPlay"));
      };
      setState("playing");
      await audio.play();
    } catch (e) {
      setState("idle");
      setProblem(speechProblem(e as Error, "hindi"));
    }
  }

  return (
    <div className="space-y-1">
      <Button variant="outline" className="h-11 w-full" disabled={state !== "idle"} onClick={read}>
        {state === "preparing" ? t("audio.preparing") : state === "playing" ? t("audio.reading") : t("audio.readAloud")}
      </Button>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
    </div>
  );
}

function PlayButton({ url, problem, label }: { url?: string; problem?: string; label: string }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  function play() {
    const audio = new Audio(url);
    const fail = (message: string) => {
      setPlaying(false);
      setError(t("audio.couldNotPlayClip", { error: message }));
    };
    audio.onended = () => setPlaying(false);
    // A missing or broken file shows up here.
    audio.onerror = () => fail(audio.error?.message || t("audio.fileNotLoaded"));
    setError("");
    setPlaying(true);
    // Firefox can reject play() with an AbortError when it restarts the download, yet still plays the clip.
    audio.play().catch((e: Error) => e.name !== "AbortError" && fail(e.message));
  }

  return (
    <div className="space-y-1">
      <Button className="h-14 w-full text-base" disabled={!url || playing} onClick={play}>
        {playing ? t("audio.playing") : label}
      </Button>
      {(problem || error) && <p className="text-sm text-destructive">{problem ?? error}</p>}
    </div>
  );
}
