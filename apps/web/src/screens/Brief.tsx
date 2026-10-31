import { questions } from "@triveni/content";
import {
  type Answer,
  buildDailyBrief,
  type Check,
  type Child,
  type ClassData,
  type ClassRecord,
  childRecord,
  needsRecheck,
  results,
  type Version,
  versionOrder,
} from "@triveni/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { symbols } from "@/components/AnswerGrid";
import { ClipButton, ReadAloud, SpeakButton } from "@/components/ClipButton";
import { SendToParents } from "@/components/SendToParents";
import { Button } from "@/components/ui/button";
import { versionsFor } from "@/check";
import { content, useClassData } from "@/classData";
import { api, saveCheck } from "@/db";
import { type Group, groupTime } from "@/group";
import { useUiLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { Kit } from "./Kit";
import { Probe } from "./Probe";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

// The morning brief, and the group time it asks for: quick re-checks, the probe and the reteaching kit.
export function Brief({ klass, onError }: { klass: ClassRecord; onError: (message: string) => void }) {
  const { t } = useTranslation("brief");
  const { language } = useUiLanguage();
  const data = useClassData(klass.id);
  const [recheck, setRecheck] = useState<{ conceptId: string; children: Child[] }>();
  const [probe, setProbe] = useState<Group>();
  const [kit, setKit] = useState<Group & { buddy: Child | undefined }>();
  if (!data) return null;

  if (recheck) {
    return <Recheck klass={klass} {...recheck} onClose={() => setRecheck(undefined)} onError={onError} />;
  }
  if (probe) return <Probe klass={klass} {...probe} onClose={() => setProbe(undefined)} onError={onError} />;
  if (kit) return <Kit {...kit} onClose={() => setKit(undefined)} />;
  const group = groupTime(data);
  return (
    <div className="space-y-6">
      <Reworded template={buildDailyBrief(today(), data, content, language)} language={language} />
      <CatchUpList data={data} />
      <RecheckList data={data} onStart={(conceptId, children) => setRecheck({ conceptId, children })} />
      <GroupList
        title={t("probeGroup.title")}
        about={t("probeGroup.about")}
        action={t("probeGroup.action")}
        groups={group.probe}
        onStart={setProbe}
      />
      <GroupList
        title={t("reteachGroup.title")}
        about={t("reteachGroup.about")}
        action={t("reteachGroup.action")}
        groups={group.reteach}
        onStart={(g) => setKit({ ...g, buddy: group.buddies.find((b) => !g.records.some((r) => r.child.id === b.id)) })}
      />
    </div>
  );
}

// The children in a group-time group, by concept, with a button to start.
function GroupList({
  title,
  about,
  action,
  groups,
  onStart,
}: {
  title: string;
  about: string;
  action: string;
  groups: Group[];
  onStart: (group: Group) => void;
}) {
  const { conceptName } = useUiLanguage();
  if (groups.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{about}</p>
      {groups.map((g) => (
        <div key={g.conceptId} className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">{conceptName(g.conceptId)}</p>
          <p className="text-sm">{g.records.map((r) => r.child.name).join(", ")}</p>
          <Button className="h-11 w-full" onClick={() => onStart(g)}>
            {action}
          </Button>
        </div>
      ))}
    </section>
  );
}

// The template straight away, then Claude's rewording if it arrives. Without a signal, the template stays.
function Reworded({ template, language }: { template: string; language: "en" | "hi" }) {
  const { t } = useTranslation("brief");
  const [reworded, setReworded] = useState<{ template: string; text: string }>();
  const [failed, setFailed] = useState(false);

  // Waits until the brief has stopped changing (the records update in bursts, such as while the demo
  // loads), so Claude is asked once rather than for every intermediate version.
  useEffect(() => {
    let current = true;
    setFailed(false);
    const wait = setTimeout(() => {
      api("POST", "/brief/reword", { brief: template, language })
        .then((res) => res.json() as Promise<{ brief: string }>)
        .then(({ brief }) => current && setReworded({ template, text: brief }))
        .catch(() => current && setFailed(true));
    }, 1500);
    return () => {
      current = false;
      clearTimeout(wait);
    };
  }, [template, language]);

  // A rewording of an older template is stale once the records change.
  const text = reworded?.template === template ? reworded.text : undefined;
  return (
    <section className="space-y-2 rounded-lg bg-muted p-4">
      <p className="whitespace-pre-line">{text ?? template}</p>
      <p className="text-xs text-muted-foreground">
        {text ? t("reworded") : failed ? t("templateOnly") : t("rewording")}
      </p>
      {language === "hi" && <ReadAloud text={text ?? template} />}
    </section>
  );
}

// Children who missed every lesson on a concept, by concept: their parents get the catch-up lesson on Telegram.
function CatchUpList({ data }: { data: ClassData }) {
  const { t } = useTranslation("brief");
  const { conceptName } = useUiLanguage();
  const all = results(data, content);
  const byConcept = new Map<string, Child[]>();
  for (const child of data.children) {
    const record = childRecord(child, data, content, all);
    for (const [conceptId, c] of Object.entries(record.concepts)) {
      if (c.status === "not_taught") byConcept.set(conceptId, [...(byConcept.get(conceptId) ?? []), child]);
    }
  }
  if (byConcept.size === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{t("catchUp.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("catchUp.about")}</p>
      {[...byConcept].map(([conceptId, children]) => (
        <div key={conceptId} className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">{conceptName(conceptId)}</p>
          <p className="text-sm">{children.map((c) => c.name).join(", ")}</p>
          <SendToParents
            kind="catch_up"
            conceptId={conceptId}
            children={children}
            label={t("catchUp.send", { count: children.length })}
          />
        </div>
      ))}
    </section>
  );
}

// Children whose pattern was seen once, by concept: a quick re-check confirms or clears them.
function RecheckList({ data, onStart }: { data: ClassData; onStart: (conceptId: string, children: Child[]) => void }) {
  const { t } = useTranslation("brief");
  const { conceptName } = useUiLanguage();
  const all = results(data, content);
  const byConcept = new Map<string, Child[]>();
  for (const child of data.children) {
    const record = childRecord(child, data, content, all);
    for (const [conceptId, c] of Object.entries(record.concepts)) {
      if (needsRecheck(c.label)) byConcept.set(conceptId, [...(byConcept.get(conceptId) ?? []), child]);
    }
  }
  if (byConcept.size === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{t("rechecks.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("rechecks.about")}</p>
      {[...byConcept].map(([conceptId, children]) => (
        <div key={conceptId} className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">{conceptName(conceptId)}</p>
          <p className="text-sm">{children.map((c) => c.name).join(", ")}</p>
          <Button className="h-11 w-full" onClick={() => onStart(conceptId, children)}>
            {t("rechecks.start")}
          </Button>
        </div>
      ))}
    </section>
  );
}

type Tap = "right" | "wrong";

// A quick re-check: the concept's re-check question, asked the same way, marked by tap.
function Recheck({
  klass,
  conceptId,
  children,
  onClose,
  onError,
}: {
  klass: ClassRecord;
  conceptId: string;
  children: Child[];
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const recheckQuestion = questions.find((q) => q.conceptId === conceptId && q.use === "recheck");
  const question = recheckQuestion ?? questions.find((q) => q.conceptId === conceptId)!;
  const { t } = useTranslation("brief");
  const { conceptName } = useUiLanguage();
  const [date] = useState(today);
  const order = versionOrder(date);
  const [taps, setTaps] = useState<Record<string, Partial<Record<Version, Tap>>>>({});

  // Each tap moves a box on: not marked, then right, then wrong, then not marked again.
  const tap = (childId: string, v: Version) => {
    const next: Record<string, Tap | undefined> = { undefined: "right", right: "wrong", wrong: undefined };
    setTaps((all) => ({ ...all, [childId]: { ...all[childId], [v]: next[String(all[childId]?.[v])] } }));
  };

  // Only children the teacher marked: a child not re-checked keeps the label they had.
  const marked = children.filter((c) => Object.values(taps[c.id] ?? {}).some(Boolean));

  async function save() {
    const check: Check = {
      id: crypto.randomUUID(),
      classId: klass.id,
      date,
      questionIds: [question.id],
      kind: "recheck",
      versionOrder: order,
      childIds: marked.map((c) => c.id),
    };
    const answers: Answer[] = marked.flatMap((child) =>
      versionsFor(child).map((version) => ({
        checkId: check.id,
        childId: child.id,
        questionId: question.id,
        row: 1,
        version,
        value: null,
        status: taps[child.id]?.[version] ?? "no_data",
        cause: null,
        confidence: null,
        reviewed: true,
      })),
    );
    try {
      await saveCheck(check, answers);
      onClose();
    } catch (e) {
      onError((e as Error).message);
      onClose();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("recheck.title", { concept: conceptName(conceptId) })}</h2>
          <p className="text-sm text-muted-foreground">{children.map((c) => c.name).join(", ")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("common:cancel")}
        </Button>
      </div>
      {!recheckQuestion && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {t("recheck.noRecheckQuestion")}
        </p>
      )}
      {order.map((version, step) => (
        <section key={version} className="space-y-2">
          <h3 className="font-semibold">
            {t("recheck.fillBox", { step: step + 1, symbol: symbols[version] })}
          </h3>
          {version === "A" && <p className="rounded-lg border p-5 text-center text-4xl font-semibold">{question.A.prompt}</p>}
          {version === "B" && <ClipButton clipId={question.B.audio} label={t("common:playInHindi")} />}
          {version === "C" && <SpeakButton text={question.C.bhili} label={t("common:playInBhili")} />}
        </section>
      ))}
      <section className="space-y-2">
        <h3 className="font-semibold">{t("recheck.tapEach", { step: order.length + 1 })}</h3>
        {children.map((child) => (
          <div key={child.id} className="grid grid-cols-[1fr_3.5rem_3.5rem_3.5rem] items-center gap-2">
            <span className="truncate">{child.name}</span>
            {(["A", "B", "C"] as const).map((v) =>
              versionsFor(child).includes(v) ? (
                <button
                  key={v}
                  aria-label={`${child.name} ${v}`}
                  onClick={() => tap(child.id, v)}
                  className={cn(
                    "h-11 rounded-md border text-lg",
                    taps[child.id]?.[v] === "right" && "border-green-600 bg-green-50 text-green-700",
                    taps[child.id]?.[v] === "wrong" && "border-destructive bg-destructive/10 text-destructive",
                  )}
                >
                  {taps[child.id]?.[v] === "right" ? "✓" : taps[child.id]?.[v] === "wrong" ? "✗" : symbols[v]}
                </button>
              ) : (
                <span key={v} className="text-center text-xs text-muted-foreground">
                  —
                </span>
              ),
            )}
          </div>
        ))}
      </section>
      <Button className="h-12 w-full" disabled={marked.length === 0} onClick={save}>
        {marked.length > 0 ? t("recheck.saveCount", { children: t("common:children", { count: marked.length }) }) : t("recheck.save")}
      </Button>
    </div>
  );
}
