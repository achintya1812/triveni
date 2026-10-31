import type { Child, ParentMessage, ParentReply } from "@triveni/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { clipUrl } from "@/audio";
import { base64 } from "@/components/VoiceNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadConversations, replyToParent } from "@/db";
import { useUiLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

type Conversations = Awaited<ReturnType<typeof loadConversations>>;
type Item = { at: string; from: "teacher"; message: ParentMessage } | { at: string; from: "parent"; reply: ParentReply };

// Catch-ups and activities are in the public `audio` bucket; voice replies, both ways, in the private
// `parent-media` bucket, which the API links to.
const mediaUrl = (file: string) => `${import.meta.env.VITE_API_URL}/parent-media/${file}`;

// Telegram plays only OGG/Opus, MP3 and M4A as voice messages: Firefox records OGG, Chrome and Safari M4A.
const voiceType = () =>
  typeof MediaRecorder === "undefined"
    ? undefined
    : ["audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2"].find((t) => MediaRecorder.isTypeSupported(t));
const maxSeconds = 60;

// Everything sent to and received from one child's parent, oldest first.
function thread(childId: string, { messages, replies }: Conversations): Item[] {
  const items: Item[] = [
    ...messages.filter((m) => m.childId === childId).map((message) => ({ at: message.sentAt ?? "", from: "teacher" as const, message })),
    ...replies.filter((r) => r.childId === childId).map((reply) => ({ at: reply.receivedAt, from: "parent" as const, reply })),
  ];
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

// The parents on Telegram and what they sent back. Tapping a parent opens the conversation, where the teacher
// can reply with a text or a voice note. Read from the API, so it needs a signal.
export function ParentMessages({ children, classId, onClose }: { children: Child[]; classId: string; onClose: () => void }) {
  const { t } = useTranslation("messages");
  const [data, setData] = useState<Conversations>();
  const [problem, setProblem] = useState("");
  const [open, setOpen] = useState<Child>();

  const load = useCallback(() => {
    setProblem("");
    loadConversations(classId)
      .then(setData)
      .catch((e: Error) => setProblem(t("couldNotLoad", { error: e.message })));
  }, [classId, t]);
  useEffect(load, [load]);

  if (open && data) return <Conversation child={open} items={thread(open.id, data)} onSent={load} onClose={() => setOpen(undefined)} />;

  const latest = (childId: string) => (data ? thread(childId, data).at(-1)?.at ?? "" : "");
  const parents = children
    .filter((c) => c.parentChatId || (data && thread(c.id, data).length > 0))
    .sort((a, b) => latest(b.id).localeCompare(latest(a.id)) || a.rollNo - b.rollNo);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("help")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("common:close")}
        </Button>
      </div>
      <Button variant="outline" className="h-11 w-full" onClick={load}>
        {t("refresh")}
      </Button>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      {!data && !problem && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {data && parents.length === 0 && <p className="text-sm">{t("noParents")}</p>}
      {data &&
        parents.map((child) => {
          const replies = data.replies.filter((r) => r.childId === child.id).length;
          return (
            <button key={child.id} className="w-full space-y-1 rounded-lg border p-3 text-left" onClick={() => setOpen(child)}>
              <p className="font-medium">
                {child.rollNo}. {child.name}
              </p>
              <p className="text-sm text-muted-foreground">{replies > 0 ? t("replies", { count: replies }) : t("noReplies")}</p>
            </button>
          );
        })}
    </div>
  );
}

function Conversation({ child, items, onSent, onClose }: { child: Child; items: Item[]; onSent: () => void; onClose: () => void }) {
  const { t } = useTranslation("messages");
  const { language, conceptName } = useUiLanguage();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "starting" | "recording" | "sending">("idle");
  const [problem, setProblem] = useState("");
  const held = useRef(false);
  const recorder = useRef<MediaRecorder>(null);
  const recordAs = voiceType();
  const time = (at: string) =>
    at ? new Date(at).toLocaleString(language === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

  async function send(reply: { text: string } | { audio: string; mimeType: string }) {
    setState("sending");
    setProblem("");
    try {
      await replyToParent(child.id, reply);
      if ("text" in reply) setText("");
    } catch (e) {
      setProblem(t("parents:couldNotSend", { error: (e as Error).message }));
    }
    setState("idle");
    onSent();
  }

  // Hold to record, let go to send, as in the daily log's voice note.
  async function start() {
    held.current = true;
    setProblem("");
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("idle");
      return setProblem(t("noMic"));
    }
    const rec = new MediaRecorder(stream, { mimeType: recordAs });
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      if (Date.now() - startedAt < 700) {
        setState("idle");
        return setProblem(t("log:voice.holdDown"));
      }
      const mimeType = rec.mimeType.split(";")[0];
      await send({ audio: await base64(new Blob(chunks, { type: mimeType })), mimeType });
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
    setTimeout(() => rec.state === "recording" && rec.stop(), maxSeconds * 1000);
    if (!held.current) rec.stop();
  }

  function stop() {
    held.current = false;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  const voice = (src: string) => <audio controls preload="none" src={src} className="h-10 w-full" />;
  const sentLabel = (m: ParentMessage) => {
    if (m.kind === "reply") return null;
    return t(m.kind === "catch_up" ? "catchUp" : "activity", { concept: conceptName(m.conceptId ?? "") });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">{t("thread", { name: child.name })}</h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("back")}
        </Button>
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.from === "teacher" ? item.message.id : item.reply.id}
            className={cn("space-y-1 rounded-lg p-3 text-sm", item.from === "teacher" ? "ml-8 bg-muted" : "mr-8 border")}
          >
            <p className="text-xs text-muted-foreground">
              {item.from === "teacher" ? t("you") : t("parent")} · {time(item.at)}
            </p>
            {item.from === "teacher" ? (
              <>
                {sentLabel(item.message) && <p>{sentLabel(item.message)}</p>}
                {item.message.text && <p className="whitespace-pre-wrap">{item.message.text}</p>}
                {item.message.file && voice(item.message.kind === "reply" ? mediaUrl(item.message.file) : clipUrl(item.message.file))}
                {item.message.status === "failed" && <p className="text-destructive">{t("notSent")}</p>}
              </>
            ) : (
              <>
                {item.reply.type === "done" && <p>{t("done")}</p>}
                {item.reply.text && <p className="whitespace-pre-wrap">{item.reply.text}</p>}
                {item.reply.file && voice(mediaUrl(item.reply.file))}
                {item.reply.transcript && <p className="text-muted-foreground">{t("heard", { text: item.reply.transcript })}</p>}
              </>
            )}
          </li>
        ))}
      </ul>

      {child.parentChatId ? (
        <div className="space-y-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) send({ text: text.trim() });
            }}
          >
            <Input className="h-11" placeholder={t("placeholder")} value={text} onChange={(e) => setText(e.target.value)} />
            <Button type="submit" className="h-11 shrink-0" disabled={state !== "idle" || !text.trim()}>
              {state === "sending" ? t("parents:sending") : t("send")}
            </Button>
          </form>
          {recordAs ? (
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
              🎤 {state === "recording" ? t("recording") : t("hold")}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noVoice")}</p>
          )}
          {problem && <p className="text-sm text-destructive">{problem}</p>}
        </div>
      ) : (
        <p className="text-sm text-amber-800">{t("notOnTelegram")}</p>
      )}
    </div>
  );
}
