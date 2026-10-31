import { concepts, questions } from "@triveni/content";
import {
  type Answer,
  type BriefLanguage,
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
import { symbols } from "@/components/AnswerGrid";
import { ClipButton, ReadAloud, SpeakButton } from "@/components/ClipButton";
import { Button } from "@/components/ui/button";
import { versionsFor } from "@/check";
import { content, useClassData } from "@/classData";
import { api, saveCheck } from "@/db";
import { cn } from "@/lib/utils";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const conceptName = (id: string) => concepts.find((c) => c.id === id)?.name ?? id;

// The morning brief, and the quick re-checks it asks for.
export function Brief({ klass, onError }: { klass: ClassRecord; onError: (message: string) => void }) {
  const data = useClassData(klass.id);
  const [language, setLanguage] = useState<BriefLanguage>("en");
  const [recheck, setRecheck] = useState<{ conceptId: string; children: Child[] }>();
  if (!data) return null;

  if (recheck) {
    return <Recheck klass={klass} {...recheck} onClose={() => setRecheck(undefined)} onError={onError} />;
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2">
        {(["en", "hi"] as const).map((l) => (
          <Button key={l} variant={language === l ? "default" : "outline"} className="h-10" onClick={() => setLanguage(l)}>
            {l === "en" ? "English" : "हिंदी"}
          </Button>
        ))}
      </div>
      <Reworded template={buildDailyBrief(today(), data, content, language)} language={language} />
      <RecheckList data={data} onStart={(conceptId, children) => setRecheck({ conceptId, children })} />
    </div>
  );
}

// The template straight away, then Claude's rewording if it arrives. Without a signal, the template stays.
function Reworded({ template, language }: { template: string; language: BriefLanguage }) {
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
        {text ? "Reworded by Claude." : failed ? "Couldn't reach Claude, so this is the template." : "Rewording…"}
      </p>
      {language === "hi" && <ReadAloud text={text ?? template} />}
    </section>
  );
}

// Children whose pattern was seen once, by concept: a quick re-check confirms or clears them.
function RecheckList({ data, onStart }: { data: ClassData; onStart: (conceptId: string, children: Child[]) => void }) {
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
      <h2 className="font-semibold">Quick re-checks</h2>
      <p className="text-sm text-muted-foreground">
        Patterns seen once. A fresh A, B and C, marked by tap: two or three minutes in group time.
      </p>
      {[...byConcept].map(([conceptId, children]) => (
        <div key={conceptId} className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">{conceptName(conceptId)}</p>
          <p className="text-sm">{children.map((c) => c.name).join(", ")}</p>
          <Button className="h-11 w-full" onClick={() => onStart(conceptId, children)}>
            Start re-check
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
  const [date] = useState(today);
  const order = versionOrder(date);
  const [taps, setTaps] = useState<Record<string, Partial<Record<Version, Tap>>>>({});

  // Each tap moves a box on: not marked, then right, then wrong, then not marked again.
  const tap = (childId: string, v: Version) => {
    const next: Record<string, Tap | undefined> = { undefined: "right", right: "wrong", wrong: undefined };
    setTaps((t) => ({ ...t, [childId]: { ...t[childId], [v]: next[String(t[childId]?.[v])] } }));
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
          <h2 className="font-semibold">Quick re-check: {conceptName(conceptId)}</h2>
          <p className="text-sm text-muted-foreground">{children.map((c) => c.name).join(", ")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {!recheckQuestion && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          There's no re-check question for this concept yet, so this uses the weekly question's numbers.
        </p>
      )}
      {order.map((version, step) => (
        <section key={version} className="space-y-2">
          <h3 className="font-semibold">
            {step + 1}. Now fill the {symbols[version]} box
          </h3>
          {version === "A" && <p className="rounded-lg border p-5 text-center text-4xl font-semibold">{question.A.prompt}</p>}
          {version === "B" && <ClipButton clipId={question.B.audio} label="Play in Hindi" />}
          {version === "C" && <SpeakButton text={question.C.bhili} label="Play in Bhili" />}
        </section>
      ))}
      <section className="space-y-2">
        <h3 className="font-semibold">{order.length + 1}. Tap each box: right, then wrong</h3>
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
        Save the re-check{marked.length > 0 && ` (${marked.length} ${marked.length === 1 ? "child" : "children"})`}
      </Button>
    </div>
  );
}
