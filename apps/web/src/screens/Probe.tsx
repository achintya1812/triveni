import { concepts } from "@triveni/content";
import type { ChildRecord, ClassRecord, ProbeResult } from "@triveni/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { saveProbes } from "@/db";
import { type ProbeOutcome, probeState, probeSteps } from "@/group";
import { useUiLanguage } from "@/i18n";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const conceptFor = (id: string) => concepts.find((c) => c.id === id)!;

// The step-down probe for the children who failed a concept: one step at a time, marked ✓ or ✗ for each
// child, until their first ✓ shows where to restart.
export function Probe({
  klass,
  conceptId,
  records,
  onClose,
  onError,
}: {
  klass: ClassRecord;
  conceptId: string;
  records: ChildRecord[];
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation("probe");
  const { language, conceptName } = useUiLanguage();
  const [date] = useState(today);
  const [taps, setTaps] = useState<Record<string, boolean[]>>({});
  const children = records.map((record) => {
    const steps = probeSteps(conceptId, record.root(conceptId));
    return { child: record.child, taps: taps[record.child.id] ?? [], state: probeState(steps, taps[record.child.id] ?? []) };
  });
  const done = children.flatMap((c) => ("outcome" in c.state ? [{ child: c.child, outcome: c.state.outcome }] : []));

  const tap = (childId: string, passed: boolean) => setTaps((all) => ({ ...all, [childId]: [...(all[childId] ?? []), passed] }));
  const undo = (childId: string) => setTaps((all) => ({ ...all, [childId]: (all[childId] ?? []).slice(0, -1) }));
  // "Start with borrowing using drawings, then move to numbers."
  const restartText = (o: ProbeOutcome) => {
    if (o.passedAtOnce) return t("passed");
    const name = conceptName(o.restartConceptId!);
    return t("restart", { concept: language === "en" ? name.toLowerCase() : name, how: t(`how.${o.form}`) });
  };

  async function save() {
    const results: ProbeResult[] = done.map(({ child, outcome }) => ({
      id: crypto.randomUUID(),
      classId: klass.id,
      childId: child.id,
      conceptId,
      date,
      ...outcome,
    }));
    try {
      await saveProbes(klass.id, results);
    } catch (e) {
      onError((e as Error).message);
    }
    onClose();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("title", { concept: conceptName(conceptId) })}</h2>
          <p className="text-sm text-muted-foreground">{t("help")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("common:cancel")}
        </Button>
      </div>
      {children.map(({ child, taps: mine, state }) => {
        const step = "next" in state ? conceptFor(state.next.conceptId).probe.find((p) => p.form === state.next.form)! : undefined;
        return (
          <section key={child.id} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{child.name}</p>
              {mine.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => undo(child.id)}>
                  {t("common:undo")}
                </Button>
              )}
            </div>
            {"next" in state && step && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("step", { n: mine.length + 1, concept: conceptName(state.next.conceptId), form: t(`forms.${state.next.form}`) })}
                </p>
                <p>{language === "hi" ? step.hindi : step.english}</p>
                <p className="text-sm text-muted-foreground">{t("answer", { answer: step.answer })}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-12 text-lg" variant="outline" aria-label={t("right", { name: child.name })} onClick={() => tap(child.id, true)}>
                    ✓
                  </Button>
                  <Button className="h-12 text-lg" variant="outline" aria-label={t("wrong", { name: child.name })} onClick={() => tap(child.id, false)}>
                    ✗
                  </Button>
                </div>
              </>
            )}
            {"outcome" in state && <p className="rounded-md bg-muted p-2">{restartText(state.outcome)}</p>}
          </section>
        );
      })}
      <Button className="h-12 w-full" disabled={done.length === 0} onClick={save}>
        {done.length > 0 ? t("saveCount", { children: t("common:children", { count: done.length }) }) : t("save")}
      </Button>
    </div>
  );
}
