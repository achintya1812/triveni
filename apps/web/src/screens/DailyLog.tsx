import { concepts } from "@triveni/content";
import type { ClassRecord } from "@triveni/core";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { db, saveDay } from "@/db";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const conceptName = (id: string) => concepts.find((c) => c.id === id)?.name ?? id;
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function DailyLog({ klass, onError }: { klass: ClassRecord; onError: (message: string) => void }) {
  const [date, setDate] = useState(today);
  const [absent, setAbsent] = useState<string[]>([]);
  const [conceptId, setConceptId] = useState("");
  const [saved, setSaved] = useState(false);

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
      ? { id: logged?.lesson?.id ?? crypto.randomUUID(), classId: klass.id, date, conceptId }
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
        {klass.school}, Grade {klass.grade}
      </p>

      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          className="h-11"
          value={date}
          onChange={(e) => {
            setSaved(false);
            setDate(e.target.value);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Tap the children who are absent</Label>
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
        <Label htmlFor="concept">Concept taught today</Label>
        <NativeSelect
          id="concept"
          className="w-full [&_select]:h-11"
          value={conceptId}
          onChange={(e) => {
            setSaved(false);
            setConceptId(e.target.value);
          }}
        >
          <NativeSelectOption value="">No maths lesson</NativeSelectOption>
          {concepts.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <Button className="h-12 w-full" onClick={save}>
        {saved ? "Saved" : `Save (${absent.length} absent)`}
      </Button>

      <History classId={klass.id} />
    </div>
  );
}

function History({ classId }: { classId: string }) {
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
      <h2 className="font-semibold">History</h2>
      <ul className="divide-y rounded-lg border text-sm">
        {days.map((day) => (
          <li key={day.date} className="p-3">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{formatDate(day.date)}</span>
              <span className="text-muted-foreground">{day.conceptId ? conceptName(day.conceptId) : "No lesson"}</span>
            </div>
            <div className="text-muted-foreground">
              {day.absent.length ? `Absent: ${day.absent.join(", ")}` : "Everyone present"}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
