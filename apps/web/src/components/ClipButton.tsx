import { audioClips } from "@triveni/content";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { allowStandins, clipProblem, clipUrl } from "@/audio";

// Plays one clip from the manifest, or says why it won't.
export function ClipButton({ clipId, label }: { clipId: string; label: string }) {
  const clip = audioClips.find((c) => c.id === clipId);
  const problem = clipProblem(clip, allowStandins);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  function play() {
    const audio = new Audio(clipUrl(clip!));
    audio.onended = () => setPlaying(false);
    setError("");
    setPlaying(true);
    audio.play().catch((e: Error) => {
      setPlaying(false);
      setError(`Could not play the clip: ${e.message}`);
    });
  }

  return (
    <div className="space-y-1">
      <Button className="h-14 w-full text-base" disabled={!!problem || playing} onClick={play}>
        {playing ? "Playing…" : label}
      </Button>
      {(problem || error) && <p className="text-sm text-destructive">{problem ?? error}</p>}
      {!problem && clip?.source !== "human" && (
        <p className="text-xs text-muted-foreground">Stand-in voice for development only.</p>
      )}
    </div>
  );
}
