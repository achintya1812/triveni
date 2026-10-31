import { listeningItems } from "@triveni/content";
import { type Child, type ClassRecord, childRecord, type LanguageProfile, type ListeningResult, results } from "@triveni/core";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { SpeakButton } from "@/components/ClipButton";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { content, useClassData } from "@/classData";
import { refreshChildren, saveChild, saveListening } from "@/db";
import { cn } from "@/lib/utils";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const percent = (score: number | null) => (score === null ? "–" : `${Math.round(score * 100)}%`);
const reteachNames: Record<LanguageProfile["reteachIn"], string> = { home: "Bhili first", mixed: "both languages", school: "Hindi" };

// The class: each child's language profile, the teacher's view of how well they follow Hindi, and the
// one-time listening check.
export function ClassScreen({ klass, onError }: { klass: ClassRecord; onError: (message: string) => void }) {
  const data = useClassData(klass.id);
  const [listening, setListening] = useState(false);
  const [qrCodes, setQrCodes] = useState(false);
  // Picks up parents who have opted in on Telegram since. Offline, the children stay as they were.
  useEffect(() => {
    refreshChildren(klass.id).catch(() => {});
  }, [klass.id]);
  if (!data) return null;
  if (listening) return <ListeningCheck klass={klass} children={data.children} onClose={() => setListening(false)} onError={onError} />;
  if (qrCodes) return <ParentQrCodes children={data.children} onClose={() => setQrCodes(false)} />;

  const all = results(data, content);
  const lastListening = data.listening.map((l) => l.date).sort().at(-1);
  const setHindi = (child: Child, value: string) =>
    saveChild({ ...child, hindiUnderstanding: (value || null) as Child["hindiUnderstanding"] }).catch((e: Error) => onError(e.message));

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-lg bg-muted p-4">
        <h2 className="font-semibold">Listening check</h2>
        <p className="text-sm">
          Once for the class: four sets of pictures, each with a Hindi and a Bhili question. It shows which language each
          child follows. {lastListening ? `Last done on ${lastListening}.` : "Not done yet."}
        </p>
        <Button className="h-11 w-full" onClick={() => setListening(true)}>
          {lastListening ? "Run it again" : "Run the listening check"}
        </Button>
      </section>
      <section className="space-y-2 rounded-lg bg-muted p-4">
        <h2 className="font-semibold">Parents on Telegram</h2>
        <p className="text-sm">
          {data.children.filter((c) => c.parentChatId).length} of {data.children.length} parents get voice notes. Print each
          child's QR code and send it home: the parent scans it and taps Start.
        </p>
        <Button className="h-11 w-full" variant="outline" onClick={() => setQrCodes(true)}>
          Show parent QR codes
        </Button>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Children</h2>
        {data.children.map((child) => {
          const { language } = childRecord(child, data, content, all);
          return (
            <div key={child.id} className="space-y-2 rounded-lg border p-3">
              <p>
                <span className="font-medium">
                  {child.rollNo}. {child.name}
                </span>{" "}
                <span className="text-sm text-muted-foreground">({child.homeLanguage === "bhili" ? "Bhili" : "Hindi"} at home)</span>
              </p>
              <p className="text-sm">
                Follows Hindi {percent(language.hindi)}, Bhili {percent(language.bhili)}. Reteach in {reteachNames[language.reteachIn]}.
              </p>
              <p className="text-sm text-muted-foreground">
                {child.parentChatId ? "Parent on Telegram ✓" : "Parent not on Telegram yet"}
              </p>
              <NativeSelect
                aria-label={`How well ${child.name} follows Hindi`}
                className="w-full [&_select]:h-11"
                value={child.hindiUnderstanding ?? ""}
                onChange={(e) => setHindi(child, e.target.value)}
              >
                <NativeSelectOption value="">Follows Hindi: not set</NativeSelectOption>
                <NativeSelectOption value="well">Follows Hindi well</NativeSelectOption>
                <NativeSelectOption value="some">Follows some Hindi</NativeSelectOption>
                <NativeSelectOption value="none">Doesn't follow Hindi</NativeSelectOption>
              </NativeSelect>
            </div>
          );
        })}
      </section>
    </div>
  );
}

type Tap = "right" | "wrong";
const key = (childId: string, itemId: string, language: string) => `${childId}|${itemId}|${language}`;

// One item at a time: the teacher copies the four pictures to the board, plays both questions, and children
// write the two numbers. The teacher marks each child's two numbers by tap.
function ListeningCheck({
  klass,
  children,
  onClose,
  onError,
}: {
  klass: ClassRecord;
  children: Child[];
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [date] = useState(today);
  const [index, setIndex] = useState(0);
  const [taps, setTaps] = useState<Record<string, Tap | undefined>>({});
  const item = listeningItems[index];
  const last = index === listeningItems.length - 1;

  // Each tap moves a box on: not marked, then right, then wrong, then not marked again.
  const tap = (k: string) => {
    const next: Record<string, Tap | undefined> = { undefined: "right", right: "wrong", wrong: undefined };
    setTaps((t) => ({ ...t, [k]: next[String(t[k])] }));
  };

  // Only marked boxes are saved: a box left unmarked keeps any earlier result.
  const marked = Object.entries(taps).filter((e): e is [string, Tap] => !!e[1]);
  async function save() {
    const saved: ListeningResult[] = marked.map(([k, status]) => {
      const [childId, itemId, language] = k.split("|");
      return { classId: klass.id, childId, date, itemId, language: language as ListeningResult["language"], value: null, status };
    });
    try {
      await saveListening(klass.id, saved);
    } catch (e) {
      onError((e as Error).message);
    }
    onClose();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">
          Listening check: {index + 1} of {listeningItems.length}
        </h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <section className="space-y-2">
        <h3 className="font-semibold">1. Draw these on the board, with their numbers</h3>
        <div className="grid grid-cols-2 gap-2">
          {item.pictures.map((p) => (
            <div key={p.number} className="rounded-lg border p-3 text-center">
              <p className="text-6xl">{p.emoji}</p>
              <p className="text-lg font-semibold">{p.number}</p>
              <p className="text-sm text-muted-foreground">{p.english}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">2. Play the Hindi question, then the Bhili one</h3>
        <SpeakButton text={item.hindi.text} language="hindi" label="Play in Hindi" />
        <SpeakButton text={item.bhili.text} language="bhili" label="Play in Bhili" />
        <p className="text-sm text-muted-foreground">
          Children write two numbers. Right answers: Hindi {item.hindi.answer}, Bhili {item.bhili.answer}.
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">3. Tap each number: right, then wrong</h3>
        <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 text-center text-sm text-muted-foreground">
          <span />
          <span>Hindi</span>
          <span>Bhili</span>
        </div>
        {children.map((child) => (
          <div key={child.id} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2">
            <span className="truncate">{child.name}</span>
            {(["hindi", "bhili"] as const).map((language) => {
              const k = key(child.id, item.id, language);
              return (
                <button
                  key={language}
                  aria-label={`${child.name} ${language}`}
                  onClick={() => tap(k)}
                  className={cn(
                    "h-11 rounded-md border text-lg",
                    taps[k] === "right" && "border-green-600 bg-green-50 text-green-700",
                    taps[k] === "wrong" && "border-destructive bg-destructive/10 text-destructive",
                  )}
                >
                  {taps[k] === "right" ? "✓" : taps[k] === "wrong" ? "✗" : ""}
                </button>
              );
            })}
          </div>
        ))}
      </section>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Previous
        </Button>
        {last ? (
          <Button className="h-12" disabled={marked.length === 0} onClick={save}>
            Save
          </Button>
        ) : (
          <Button className="h-12" onClick={() => setIndex(index + 1)}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

// One QR code per child, to print and send home. Scanning it opens the bot with the child's id, so tapping
// Start opts the parent in. A parent of siblings scans each child's code.
function ParentQrCodes({ children, onClose }: { children: Child[]; onClose: () => void }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  useEffect(() => {
    Promise.all(
      children.map(async (c) => [c.id, await QRCode.toDataURL(`https://t.me/${import.meta.env.VITE_TELEGRAM_BOT}?start=${c.id}`, { margin: 1, width: 240 })]),
    ).then((pairs) => setCodes(Object.fromEntries(pairs)));
  }, [children]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="font-semibold">Parent QR codes</h2>
          <p className="text-sm text-muted-foreground">Print this page, or show a code on this phone for a parent to scan.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {children.map((c) => (
          <div key={c.id} className="break-inside-avoid space-y-1 rounded-lg border p-3 text-center">
            {codes[c.id] && <img src={codes[c.id]} alt={`QR code for ${c.name}'s parent`} className="mx-auto w-full max-w-40" />}
            <p className="font-medium">
              {c.rollNo}. {c.name}
            </p>
            <p className="text-xs text-muted-foreground">स्कैन करें, फिर Start दबाएँ</p>
          </div>
        ))}
      </div>
    </div>
  );
}
