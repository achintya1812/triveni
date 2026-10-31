import { listeningItems } from "@triveni/content";
import { type Child, type ClassRecord, childRecord, type ListeningResult, results } from "@triveni/core";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SpeakButton } from "@/components/ClipButton";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { content, useClassData } from "@/classData";
import { refreshChildren, saveChild, saveListening } from "@/db";
import { useUiLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { Setup } from "@/screens/Setup";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const percent = (score: number | null) => (score === null ? "–" : `${Math.round(score * 100)}%`);

// The class: its details to edit, each child's language profile, the teacher's view of how well they follow
// Hindi, and the one-time listening check.
export function ClassScreen({ klass, onError }: { klass: ClassRecord; onError: (message: string) => void }) {
  const { t } = useTranslation("class");
  const { formatDate } = useUiLanguage();
  const data = useClassData(klass.id);
  const [listening, setListening] = useState(false);
  const [qrCodes, setQrCodes] = useState(false);
  const [editing, setEditing] = useState(false);
  // Picks up parents who have opted in on Telegram since. Offline, the children stay as they were.
  useEffect(() => {
    refreshChildren(klass.id).catch(() => {});
  }, [klass.id]);
  if (!data) return null;
  if (listening) return <ListeningCheck klass={klass} children={data.children} onClose={() => setListening(false)} onError={onError} />;
  if (qrCodes) return <ParentQrCodes children={data.children} onClose={() => setQrCodes(false)} />;
  if (editing) return <Setup klass={klass} children={data.children} onDone={() => setEditing(false)} onError={onError} />;

  const all = results(data, content);
  const lastListening = data.listening.map((l) => l.date).sort().at(-1);
  const setHindi = (child: Child, value: string) =>
    saveChild({ ...child, hindiUnderstanding: (value || null) as Child["hindiUnderstanding"] }).catch((e: Error) => onError(e.message));

  return (
    <div className="space-y-6">
      <Button className="h-11 w-full" variant="outline" onClick={() => setEditing(true)}>
        {t("edit")}
      </Button>
      <section className="space-y-2 rounded-lg bg-muted p-4">
        <h2 className="font-semibold">{t("listening.title")}</h2>
        <p className="text-sm">
          {t("listening.about")} {lastListening ? t("listening.lastDone", { date: formatDate(lastListening) }) : t("listening.notDone")}
        </p>
        <Button className="h-11 w-full" onClick={() => setListening(true)}>
          {lastListening ? t("listening.runAgain") : t("listening.run")}
        </Button>
      </section>
      <section className="space-y-2 rounded-lg bg-muted p-4">
        <h2 className="font-semibold">{t("parents.title")}</h2>
        <p className="text-sm">{t("parents.about", { count: data.children.filter((c) => c.parentChatId).length, total: data.children.length })}</p>
        <Button className="h-11 w-full" variant="outline" onClick={() => setQrCodes(true)}>
          {t("parents.showQr")}
        </Button>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">{t("children")}</h2>
        {data.children.map((child) => {
          const { language } = childRecord(child, data, content, all);
          return (
            <div key={child.id} className="space-y-2 rounded-lg border p-3">
              <p>
                <span className="font-medium">
                  {child.rollNo}. {child.name}
                </span>{" "}
                <span className="text-sm text-muted-foreground">{t("atHome", { language: t(`common:languages.${child.homeLanguage}`) })}</span>
              </p>
              <p className="text-sm">
                {t("profile", { hindi: percent(language.hindi), bhili: percent(language.bhili), reteach: t(`reteach.${language.reteachIn}`) })}
              </p>
              <p className="text-sm text-muted-foreground">
                {child.parentChatId ? t("parentOn") : t("parentOff")}
              </p>
              <NativeSelect
                aria-label={t("hindi.label", { name: child.name })}
                className="w-full [&_select]:h-11"
                value={child.hindiUnderstanding ?? ""}
                onChange={(e) => setHindi(child, e.target.value)}
              >
                <NativeSelectOption value="">{t("hindi.notSet")}</NativeSelectOption>
                <NativeSelectOption value="well">{t("hindi.well")}</NativeSelectOption>
                <NativeSelectOption value="some">{t("hindi.some")}</NativeSelectOption>
                <NativeSelectOption value="none">{t("hindi.none")}</NativeSelectOption>
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
  const { t } = useTranslation("class");
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
          {t("check.title", { n: index + 1, total: listeningItems.length })}
        </h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("common:cancel")}
        </Button>
      </div>
      <section className="space-y-2">
        <h3 className="font-semibold">{t("check.draw")}</h3>
        <div className="grid grid-cols-2 gap-2">
          {item.pictures.map((p) => (
            <div key={p.number} className="rounded-lg border p-3 text-center">
              <p className="text-6xl">{p.emoji}</p>
              <p className="text-lg font-semibold">{p.number}</p>
              <p className="text-sm text-muted-foreground">{t(`pictures.${p.english}`)}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">{t("check.play")}</h3>
        <SpeakButton text={item.hindi.text} language="hindi" label={t("common:playInHindi")} />
        <SpeakButton text={item.bhili.text} language="bhili" label={t("common:playInBhili")} />
        <p className="text-sm text-muted-foreground">
          {t("check.write", { hindi: item.hindi.answer, bhili: item.bhili.answer })}
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">{t("check.tap")}</h3>
        <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 text-center text-sm text-muted-foreground">
          <span />
          <span>{t("common:languages.hindi")}</span>
          <span>{t("common:languages.bhili")}</span>
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
          {t("common:previous")}
        </Button>
        {last ? (
          <Button className="h-12" disabled={marked.length === 0} onClick={save}>
            {t("common:save")}
          </Button>
        ) : (
          <Button className="h-12" onClick={() => setIndex(index + 1)}>
            {t("common:next")}
          </Button>
        )}
      </div>
    </div>
  );
}

// One QR code per child, to print and send home. Scanning it opens the bot with the child's id, so tapping
// Start opts the parent in. A parent of siblings scans each child's code.
function ParentQrCodes({ children, onClose }: { children: Child[]; onClose: () => void }) {
  const { t } = useTranslation("class");
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
          <h2 className="font-semibold">{t("qr.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("qr.help")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("common:close")}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {children.map((c) => (
          <div key={c.id} className="break-inside-avoid space-y-1 rounded-lg border p-3 text-center">
            {codes[c.id] && <img src={codes[c.id]} alt={t("qr.alt", { name: c.name })} className="mx-auto w-full max-w-40" />}
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
