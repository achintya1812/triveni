import { concepts } from "@triveni/content";
import type { ChildRecord, ClassRecord, ProbeForm, ProbeResult } from "@triveni/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveProbes } from "@/db";
import { type ProbeOutcome, probeState, probeSteps } from "@/group";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const conceptFor = (id: string) => concepts.find((c) => c.id === id)!;
const formNames: Record<ProbeForm, string> = { abstract: "in numbers", pictorial: "with drawings", concrete: "with real objects" };
const restartNames: Record<ProbeForm, string> = {
  concrete: "using real objects, then move to drawings",
  pictorial: "using drawings, then move to numbers",
  abstract: "in numbers",
};

const restartText = (o: ProbeOutcome) =>
  o.passedAtOnce ? "Passed at once: back with the class." : `Start with ${conceptFor(o.restartConceptId!).name.toLowerCase()} ${restartNames[o.form!]}.`;

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
  const [date] = useState(today);
  const [taps, setTaps] = useState<Record<string, boolean[]>>({});
  const children = records.map((record) => {
    const steps = probeSteps(conceptId, record.root(conceptId));
    return { child: record.child, taps: taps[record.child.id] ?? [], state: probeState(steps, taps[record.child.id] ?? []) };
  });
  const done = children.flatMap((c) => ("outcome" in c.state ? [{ child: c.child, outcome: c.state.outcome }] : []));

  const tap = (childId: string, passed: boolean) => setTaps((t) => ({ ...t, [childId]: [...(t[childId] ?? []), passed] }));
  const undo = (childId: string) => setTaps((t) => ({ ...t, [childId]: (t[childId] ?? []).slice(0, -1) }));

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
          <h2 className="font-semibold">Probe: {conceptFor(conceptId).name}</h2>
          <p className="text-sm text-muted-foreground">
            Ask each child their step, out loud. Tap ✓ if they get it right, ✗ if not. A child stops at their first ✓.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
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
                  Undo
                </Button>
              )}
            </div>
            {"next" in state && step && (
              <>
                <p className="text-sm text-muted-foreground">
                  Step {mine.length + 1}: {conceptFor(state.next.conceptId).name}, {formNames[state.next.form]}
                </p>
                <p>{step.hindi}</p>
                <p className="text-sm text-muted-foreground">
                  {step.english} Answer: {step.answer}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-12 text-lg" variant="outline" aria-label={`${child.name} right`} onClick={() => tap(child.id, true)}>
                    ✓
                  </Button>
                  <Button className="h-12 text-lg" variant="outline" aria-label={`${child.name} wrong`} onClick={() => tap(child.id, false)}>
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
        Save the probe{done.length > 0 && ` (${done.length} ${done.length === 1 ? "child" : "children"})`}
      </Button>
    </div>
  );
}
