import type { Child, ParentMessage } from "@triveni/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("parents");
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
      setProblem(t("couldNotSend", { error: (e as Error).message }));
    }
    setState("idle");
  }

  const sent = result?.messages.filter((m) => m.status === "sent") ?? [];
  return (
    <div className="space-y-2">
      <Button className="h-11 w-full" variant="outline" disabled={state === "sending"} onClick={send}>
        {state === "sending" ? t("sending") : label}
      </Button>
      {result && (
        <ul className="space-y-1 text-sm">
          {sent.length > 0 && <li>{t("sent", { names: names(children, sent.map((m) => m.childId)) })}</li>}
          {result.notOptedIn.length > 0 && (
            <li className="text-amber-800">{t("notOptedIn", { names: names(children, result.notOptedIn) })}</li>
          )}
          {result.failed.map((f) => (
            <li key={f.childId} className="text-destructive">
              {t("failed", { name: names(children, [f.childId]), error: f.error })}
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="text-sm text-destructive">{problem}</p>}
    </div>
  );
}
