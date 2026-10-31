import { audioClips, concepts, questions } from "@triveni/content";
import { type Check, type Child, type ClassRecord, pickConcepts, type SlateReading, versionOrder } from "@triveni/core";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnswerGrid, symbols } from "@/components/AnswerGrid";
import { cacheAudio, clipUrl, speak } from "@/audio";
import { ClipButton, SpeakButton } from "@/components/ClipButton";
import { SlatePhotos } from "@/components/SlatePhotos";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { applySlates, fillSlate, type GridReads, isFlagged, markGrid, rollFlags, type UnplacedSlate } from "@/check";
import { type Draft, db, saveCheck, setAbsent } from "@/db";
import { useUiLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const weeklyQuestion = (conceptId: string) => questions.find((q) => q.conceptId === conceptId && q.use === "weekly");
const questionFor = (id: string) => questions.find((q) => q.id === id)!;

// The weekly check: one or two concepts (a row on the slate each), asked in this week's order.
// The check in progress is a draft in Dexie, so it survives switching screens and reloading.
export function CheckRunner({ klass, onError }: { klass: ClassRecord; onError: (message: string) => void }) {
  const stored = useLiveQuery(async () => (await db.drafts.get(klass.id)) ?? null, [klass.id]);
  const children = useLiveQuery(() => db.children.where({ classId: klass.id }).sortBy("rollNo"), [klass.id]);
  const [savedOn, setSavedOn] = useState<string>();

  if (stored === undefined || !children) return null;
  if (stored === null) return <StartCheck klass={klass} savedOn={savedOn} />;
  return (
    <RunCheck
      key={stored.checkId}
      klass={klass}
      stored={stored}
      roster={children}
      onSaved={setSavedOn}
      onError={onError}
    />
  );
}

// Picks the concepts, suggested from what was taught since the last weekly check.
function StartCheck({ klass, savedOn }: { klass: ClassRecord; savedOn?: string }) {
  const { t } = useTranslation("check");
  const { conceptName } = useUiLanguage();
  const suggestion = useLiveQuery(async () => {
    const lessons = await db.lessons.where({ classId: klass.id }).toArray();
    const checks = await db.checks.where({ classId: klass.id }).toArray();
    const lastWeekly = checks.filter((c) => c.kind === "weekly").map((c) => c.date).sort().at(-1) ?? null;
    return pickConcepts(lessons, concepts, lastWeekly).filter((id) => weeklyQuestion(id));
  }, [klass.id]);
  const [rows, setRows] = useState<[string, string]>(["", ""]);
  useEffect(() => {
    if (suggestion) setRows([suggestion[0] ?? "", suggestion[1] ?? ""]);
  }, [suggestion]);

  const checkable = concepts.filter((c) => weeklyQuestion(c.id));
  async function start() {
    const questionIds = [...new Set(rows.filter(Boolean))].map((id) => weeklyQuestion(id)!.id);
    const draft: Draft = {
      classId: klass.id,
      checkId: crypto.randomUUID(),
      date: today(),
      questionIds,
      grids: questionIds.map(() => ({ values: {}, reads: {} })),
      rolls: [],
      unplaced: [],
    };
    await db.drafts.put(draft);
  }

  return (
    <div className="space-y-4">
      {savedOn && <p className="rounded-lg bg-muted p-3 text-sm">{t("savedOn", { date: savedOn })}</p>}
      <p className="text-sm text-muted-foreground">
        {suggestion?.length
          ? t("suggested")
          : t("nothingNew")}
      </p>
      {([0, 1] as const).map((i) => (
        <div key={i} className="space-y-2">
          <Label htmlFor={`check-row-${i}`}>{i === 0 ? t("row1") : t("row2")}</Label>
          <NativeSelect
            id={`check-row-${i}`}
            className="w-full [&_select]:h-11"
            value={rows[i]}
            onChange={(e) => setRows(i === 0 ? [e.target.value, rows[1]] : [rows[0], e.target.value])}
          >
            <NativeSelectOption value="">{i === 0 ? t("pick") : t("none")}</NativeSelectOption>
            {checkable.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {conceptName(c.id)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ))}
      <Button className="h-12 w-full" disabled={!rows[0]} onClick={start}>
        {t("start")}
      </Button>
    </div>
  );
}

function RunCheck({
  klass,
  stored,
  roster,
  onSaved,
  onError,
}: {
  klass: ClassRecord;
  stored: Draft;
  roster: Child[];
  onSaved: (date: string) => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation("check");
  const { language, conceptName, formatDate } = useUiLanguage();
  // The screen's copy of the draft, so typing stays smooth. Every change goes to both copies, so a photo
  // read that finishes after the teacher has switched screens still lands in the stored draft.
  const [draft, setDraft] = useState(stored);
  const change = useCallback(
    (fn: (d: Draft) => Draft) => {
      setDraft(fn);
      return db.transaction("rw", db.drafts, async () => {
        const latest = await db.drafts.get(klass.id);
        if (latest?.checkId === stored.checkId) await db.drafts.put(fn(latest));
      });
    },
    [klass.id, stored.checkId],
  );

  const absentToday = useLiveQuery(
    async () =>
      new Set(
        (await db.attendance.where({ date: draft.date }).toArray())
          .filter((r) => r.classId === klass.id && !r.present)
          .map((r) => r.childId),
      ),
    [klass.id, draft.date],
  );
  const absent = absentToday ?? new Set<string>();
  const present = roster.filter((c) => !absent.has(c.id));
  const rows = draft.questionIds.map(questionFor);
  const order = versionOrder(draft.date);

  // While there's a signal, the check's B and C clips go into the service worker's cache, so the check
  // can run with none.
  useEffect(() => {
    const questions = draft.questionIds.map(questionFor);
    const b = questions.flatMap((q) => audioClips.find((c) => c.id === q.B.audio)?.file ?? []).map(clipUrl);
    Promise.all(questions.map((q) => speak(q.C.bhili).catch(() => null)))
      .then((c) => cacheAudio([...b, ...c.filter((url): url is string => !!url)]))
      .catch(() => {});
  }, [draft.questionIds]);

  const readPhoto = useCallback(
    (reading: SlateReading, photo: number) =>
      change((d) => {
        const read = applySlates(roster, d.grids, reading, photo);
        return { ...d, grids: read.grids, rolls: [...d.rolls, ...read.placed.map((c) => c.rollNo)], unplaced: [...d.unplaced, ...read.unplaced] };
      }),
    [change, roster],
  );
  const sameSlate = (a: UnplacedSlate, b: UnplacedSlate) => a.photo === b.photo && a.slate === b.slate;
  const placeByHand = (slate: UnplacedSlate, child: Child | undefined) =>
    change((d) => ({
      ...d,
      grids: child ? fillSlate(d.grids, child, slate.answers) : d.grids,
      rolls: child ? [...d.rolls, child.rollNo] : d.rolls,
      unplaced: d.unplaced.filter((u) => !sameSlate(u, slate)),
    }));

  async function toggleAbsent(childId: string) {
    try {
      await setAbsent(klass.id, draft.date, childId, !absent.has(childId));
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function save() {
    const check: Check = {
      id: draft.checkId,
      classId: klass.id,
      date: draft.date,
      questionIds: draft.questionIds,
      kind: "weekly",
      versionOrder: order,
      childIds: null,
    };
    const answers = rows.flatMap((q, i) => markGrid(check.id, q, present, draft.grids[i].values, draft.grids[i].reads, i + 1));
    try {
      await saveCheck(check, answers);
      await db.drafts.delete(klass.id);
      await db.photos.where({ checkId: draft.checkId }).delete();
      onSaved(draft.date);
    } catch (e) {
      // Saved on this phone; the draft stays, so the teacher can save again to send it.
      onError((e as Error).message);
    }
  }

  async function discard() {
    if (!window.confirm(t("discardConfirm"))) return;
    await db.drafts.delete(klass.id);
    await db.photos.where({ checkId: draft.checkId }).delete();
  }

  const rowLabel = (i: number) => (rows.length > 1 ? t("rowLabel", { row: i + 1 }) : "");
  const { missing, duplicate } = rollFlags(present, draft.rolls);
  const flagged = new Set([...missing, ...duplicate].map((c) => c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("title", { date: formatDate(draft.date) })}</h2>
          <p className="text-sm text-muted-foreground">{rows.map((q, i) => `${rowLabel(i)}${conceptName(q.conceptId)}`).join(" · ")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={discard}>
          {t("common:discard")}
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">{t("whoAbsent")}</h2>
        <p className="text-sm text-muted-foreground">{t("absentHelp")}</p>
        <div className="flex flex-wrap gap-2">
          {roster.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleAbsent(c.id)}
              className={cn(
                "rounded-full border px-3 py-2 text-sm",
                absent.has(c.id) ? "border-destructive bg-destructive/10 text-destructive" : "text-muted-foreground",
              )}
            >
              {c.rollNo} {c.name}
            </button>
          ))}
        </div>
      </section>

      {order.map((version, step) => (
        <section key={version} className="space-y-3">
          <h2 className="font-semibold">
            {t("fillBox", { step: step + 1, symbol: symbols[version] })}
          </h2>
          {rows.map((q, i) => (
            <div key={q.id} className="space-y-1">
              {version === "A" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {rowLabel(i)}
                    {t("writeOnBoard")}
                  </p>
                  <p className="rounded-lg border p-5 text-center text-4xl font-semibold">{q.A.prompt}</p>
                </>
              )}
              {version === "B" && (
                <>
                  <ClipButton clipId={q.B.audio} label={`${rowLabel(i)}${t("common:playInHindi")}`} />
                  <p className="text-sm text-muted-foreground">{language === "hi" ? q.B.hindi : q.B.english}</p>
                </>
              )}
              {version === "C" && (
                <>
                  <SpeakButton text={q.C.bhili} label={`${rowLabel(i)}${t("common:playInBhili")}`} />
                  <p className="text-sm text-muted-foreground">{language === "hi" ? q.C.scriptHi : q.C.english}</p>
                </>
              )}
            </div>
          ))}
          {version === "C" && <p className="text-sm text-muted-foreground">{t("hindiSkip")}</p>}
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="font-semibold">{t("enterAnswers", { step: order.length + 1 })}</h2>
        <p className="text-sm text-muted-foreground">{t("enterHelp")}</p>
        <SlatePhotos checkId={draft.checkId} roster={roster} rows={rows.length} onRead={readPhoto} />
        <PhotoFlags roster={present} reads={draft.grids.map((g) => g.reads)} rolls={draft.rolls} />
        <Unplaced
          slates={draft.unplaced}
          rows={rows.length}
          children={present.filter((c) => !draft.rolls.includes(c.rollNo))}
          onPlace={placeByHand}
        />
        {rows.map((q, i) => (
          <div key={q.id} className="space-y-2">
            {rows.length > 1 && (
              <h3 className="font-medium">
                {rowLabel(i)}
                {conceptName(q.conceptId)}
              </h3>
            )}
            <AnswerGrid
              roster={roster}
              values={draft.grids[i].values}
              reads={draft.grids[i].reads}
              flaggedRows={flagged}
              absent={absent}
              onChange={(values, reads) => change((d) => ({ ...d, grids: d.grids.map((g, j) => (j === i ? { values, reads } : g)) }))}
            />
          </div>
        ))}
      </section>

      <Button className="h-12 w-full" onClick={save}>
        {t("saveAnswers")}
      </Button>
    </div>
  );
}

const rollList = (children: Child[]) => children.map((c) => `${c.rollNo} ${c.name}`).join(", ");

// What the teacher needs to check after reading photos.
function PhotoFlags({ roster, reads, rolls }: { roster: Child[]; reads: GridReads[]; rolls: number[] }) {
  const { t } = useTranslation("check");
  if (rolls.length === 0) return null;
  const { duplicate, missing } = rollFlags(roster, rolls);
  const boxes = reads.flatMap((g) => Object.values(g).flatMap((r) => Object.values(r))).filter(isFlagged).length;
  const notes = [
    boxes > 0 && t("flags.boxes", { count: boxes }),
    missing.length > 0 && t("flags.missing", { list: rollList(missing) }),
    duplicate.length > 0 && t("flags.duplicate", { list: rollList(duplicate) }),
  ].filter(Boolean);
  if (notes.length === 0) return <p className="text-sm text-muted-foreground">{t("flags.allClear")}</p>;
  return (
    <ul className="list-disc space-y-1 rounded-lg bg-amber-50 p-3 pl-7 text-sm text-amber-900">
      {notes.map((note) => (
        <li key={note as string}>{note}</li>
      ))}
    </ul>
  );
}

// Slates whose child couldn't be told for sure: an unclear roll, a roll and a name that disagree, or neither
// in the class. The teacher gives each one to a child who has no slate yet, or ignores it.
function Unplaced({
  slates,
  rows,
  children,
  onPlace,
}: {
  slates: UnplacedSlate[];
  rows: number;
  children: Child[];
  onPlace: (slate: UnplacedSlate, child: Child | undefined) => void;
}) {
  const { t } = useTranslation("check");
  if (slates.length === 0) return null;
  const written = (s: UnplacedSlate) =>
    [
      s.rollAsWritten ? t("unplaced.rollWritten", { roll: s.rollAsWritten }) : t("unplaced.noRoll"),
      s.name && t("unplaced.nameWritten", { name: s.name }),
    ]
      .filter(Boolean)
      .join(", ");
  const answers = (s: UnplacedSlate) =>
    s.answers
      .filter((a) => a.row <= rows)
      .map((a) => `${rows > 1 ? `${a.row}` : ""}${symbols[a.version]} ${a.value ?? "–"}`)
      .join("  ");
  return (
    <section className="space-y-2 rounded-lg bg-amber-50 p-3 text-amber-950">
      <h3 className="font-medium">{t("unplaced.title")}</h3>
      <p className="text-sm">{t("unplaced.help")}</p>
      {slates.map((s) => (
        <div key={`${s.photo}-${s.slate}`} className="space-y-2 rounded-md border border-amber-200 bg-white p-2">
          <p className="text-sm">
            {t("unplaced.where", { photo: s.photo, slate: s.slate, written: written(s) })}
          </p>
          <p className="text-sm text-muted-foreground">{answers(s)}</p>
          <div className="flex gap-2">
            <NativeSelect
              aria-label={t("unplaced.whose", { photo: s.photo, slate: s.slate })}
              className="flex-1 [&_select]:h-11"
              value=""
              onChange={(e) => onPlace(s, children.find((c) => c.id === e.target.value))}
            >
              <NativeSelectOption value="">{t("unplaced.chooseChild")}</NativeSelectOption>
              {children.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.rollNo} {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button variant="outline" className="h-11" onClick={() => onPlace(s, undefined)}>
              {t("common:ignore")}
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
