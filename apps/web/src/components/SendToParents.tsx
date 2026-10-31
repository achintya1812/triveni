import type { Child, ParentMessage } from "@triveni/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type SendResult, sendToParents } from "@/db";

const names = (children: Child[], ids: string[]) =>
  ids.map((id) => children.find((c) => c.id === id)?.name ?? "?").join(", ");

// Sends the children's parents a voice note on Telegram, in each child's home language, and says who got it,
// whose parent isn't on Telegram yet, and what failed.
export function SendToParents({
  kind,
  conceptId,
  children,
  label,
}: {
  kind: ParentMessage["kind"];
  conceptId: string;
  children: Child[];
  label: string;
}) {
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [result, setResult] = useState<SendResult>();
  const [problem, setProblem] = useState("");

  async function send() {
    setState("sending");
    setProblem("");
    try {
      setResult(
        await sendToParents(
          kind,
          conceptId,
          children.map((c) => c.id),
        ),
      );
    } catch (e) {
      setProblem(`Couldn't send: ${(e as Error).message}`);
    }
    setState("idle");
  }

  const sent = result?.messages.filter((m) => m.status === "sent") ?? [];
  return (
    <div className="space-y-2">
      <Button className="h-11 w-full" variant="outline" disabled={state === "sending"} onClick={send}>
        {state === "sending" ? "Sending…" : label}
      </Button>
      {result && (
        <ul className="space-y-1 text-sm">
          {sent.length > 0 && <li>Sent on Telegram to the parents of {names(children, sent.map((m) => m.childId))}.</li>}
          {result.notOptedIn.length > 0 && (
            <li className="text-amber-800">
              Not on Telegram yet: {names(children, result.notOptedIn)}. Give their parents the QR code from the Class tab.
            </li>
          )}
          {result.failed.map((f) => (
            <li key={f.childId} className="text-destructive">
              Couldn't send to {names(children, [f.childId])}'s parent: {f.error}
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="text-sm text-destructive">{problem}</p>}
    </div>
  );
}
