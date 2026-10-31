import { concepts } from "@triveni/content";
import type { ClassRecord } from "@triveni/core";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { type NoteResult, VoiceNote } from "@/components/VoiceNote";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { db, saveDay } from "@/db";
import { useUiLanguage } from "@/i18n";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

export function DailyLog({ klass, onError }: { klass: ClassRecord; onError: (message: string) => void }) {
  const { t } = useTranslation("log");
  const { conceptName } = useUiLanguage();
  const [date, setDate] = useState(today);
  const [absent, setAbsent] = useState<string[]>([]);
  const [conceptId, setConceptId] = useState("");
  const [saved, setSaved] = useState(false);
  // A voice note recorded on this screen, saved with the lesson.
  const [note, setNote] = useState<NoteResult | null>(null);

  const children = useLiveQuery(() => db.children.where({ classId: klass.id }).sortBy("rollNo"), [klass.id]);
  const logged = useLiveQuery(
    async () => ({
      absent: (await db.attendance.where({ date }).toArray()).filter((r) => !r.present).map((r) => r.childId),
      lesson: await db.lessons.where({ date }).first(),
    }),
    [date],
  );

  // Show what was already saved for the chosen date; everyone is present by default.
  useEffect(() => {
    if (!logged) return;
    setAbsent(logged.absent);
    setConceptId(logged.lesson?.conceptId ?? "");
  }, [logged]);

  const toggle = (childId: string) => {
    setSaved(false);
    setAbsent(absent.includes(childId) ? absent.filter((id) => id !== childId) : [...absent, childId]);
  };

  async function save() {
    const lesson = conceptId
      ? // Keeps a voice note's transcript and page when the teacher only changes the absences.
        {
          source: "dropdown" as const,
          transcript: null,
          page: null,
          ...logged?.lesson,
          ...(note && { source: "voice" as const, transcript: note.transcript, page: note.page }),
          id: logged?.lesson?.id ?? crypto.randomUUID(),
          classId: klass.id,
          date,
          conceptId,
        }
      : undefined;
    try {
      await saveDay(klass.id, date, absent, lesson);
      setSaved(true);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t("school", { school: klass.school, grade: klass.grade })}
      </p>

      <div className="space-y-2">
        <Label htmlFor="date">{t("date")}</Label>
        <Input
          id="date"
          type="date"
          className="h-11"
          value={date}
          onChange={(e) => {
            setSaved(false);
            setNote(null);
            setDate(e.target.value);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("tapAbsent")}</Label>
        <div className="grid grid-cols-4 gap-2">
          {children?.map((child) => {
            const isAbsent = absent.includes(child.id);
            return (
              <Button
                key={child.id}
                variant={isAbsent ? "destructive" : "outline"}
                aria-pressed={isAbsent}
                className="h-16 flex-col gap-0 px-1"
                onClick={() => toggle(child.id)}
              >
                <span className="text-lg">{child.rollNo}</span>
                <span className="w-full truncate text-xs">{child.name}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="concept">{t("concept")}</Label>
        <VoiceNote
          classId={klass.id}
          onResult={(result) => {
            setSaved(false);
            setNote(result);
            setConceptId(result.conceptId ?? "");
          }}
        />
        {note && !note.transcript.trim() && (
          <p className="text-sm text-destructive">{t("voice.nothingHeard")}</p>
        )}
        {note?.transcript.trim() && (
          <p className="text-sm text-muted-foreground">
            {t("voice.heard", { transcript: note.transcript })}{" "}
            {note.conceptId
              ? note.via === "page"
                ? t("voice.byPage", { page: note.page, concept: conceptName(note.conceptId) })
                : t("voice.matched", { concept: conceptName(note.conceptId) })
              : t("voice.unknown")}{" "}
            {t("voice.checkBelow")}
          </p>
        )}
        <NativeSelect
          id="concept"
          className="w-full [&_select]:h-11"
          value={conceptId}
          onChange={(e) => {
            setSaved(false);
            setConceptId(e.target.value);
          }}
        >
          <NativeSelectOption value="">{t("noLesson")}</NativeSelectOption>
          {concepts.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {conceptName(c.id)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <Button className="h-12 w-full" onClick={save}>
        {saved ? t("saved") : t("save", { count: absent.length })}
      </Button>

      <History classId={klass.id} />
    </div>
  );
}

function History({ classId }: { classId: string }) {
  const { t } = useTranslation("log");
  const { conceptName, formatDate } = useUiLanguage();
  const days = useLiveQuery(async () => {
    const [rows, lessons, children] = await Promise.all([
      db.attendance.where({ classId }).toArray(),
      db.lessons.where({ classId }).toArray(),
      db.children.where({ classId }).toArray(),
    ]);
    const dates = [...new Set(rows.map((r) => r.date))].sort().reverse();
    return dates.map((date) => ({
      date,
      conceptId: lessons.find((l) => l.date === date)?.conceptId,
      absent: rows
        .filter((r) => r.date === date && !r.present)
        .map((r) => children.find((c) => c.id === r.childId)?.name ?? "?"),
    }));
  }, [classId]);

  if (!days?.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{t("history")}</h2>
      <ul className="divide-y rounded-lg border text-sm">
        {days.map((day) => (
          <li key={day.date} className="p-3">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{formatDate(day.date)}</span>
              <span className="text-muted-foreground">{day.conceptId ? conceptName(day.conceptId) : t("noLessonDay")}</span>
            </div>
            <div className="text-muted-foreground">
              {day.absent.length ? t("absentList", { names: day.absent.join(", ") }) : t("everyonePresent")}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
