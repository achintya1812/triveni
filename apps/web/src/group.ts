import { concepts } from "@triveni/content";
import {
  buddies,
  type Child,
  type ChildRecord,
  type ClassData,
  childRecord,
  type Language,
  type ProbeForm,
  type ProbeResult,
  results,
} from "@triveni/core";
import { content } from "./classData";

export type ProbeStepAt = { conceptId: string; form: ProbeForm };
export type ProbeOutcome = Pick<ProbeResult, "passedAtOnce" | "restartConceptId" | "form">;

// The step-down probe for a failed concept: the concept in numbers first, then from the child's root:
// numbers, drawings, real objects, then the same for the root's own prerequisite, and so on down.
export function probeSteps(conceptId: string, root: string): ProbeStepAt[] {
  const steps: ProbeStepAt[] = [{ conceptId, form: "abstract" }];
  for (let id: string | undefined = root; id; id = concepts.find((c) => c.id === id)?.prerequisites[0]) {
    for (const form of ["abstract", "pictorial", "concrete"] as const) {
      // The root can be the failed concept itself, whose numbers step was just asked.
      if (id !== conceptId || form !== "abstract") steps.push({ conceptId: id, form });
    }
  }
  return steps;
}

// Where a child is after the teacher's taps (true for ✓): the next step, or, from their first ✓, the outcome.
export function probeState(steps: ProbeStepAt[], taps: boolean[]): { next: ProbeStepAt } | { outcome: ProbeOutcome } {
  const passed = taps.indexOf(true);
  if (passed === 0) return { outcome: { passedAtOnce: true, restartConceptId: null, form: null } };
  if (passed > 0) return { outcome: { passedAtOnce: false, restartConceptId: steps[passed].conceptId, form: steps[passed].form } };
  if (taps.length < steps.length) return { next: steps[taps.length] };
  // Not even real objects on the first concept: start there.
  const last = steps.at(-1)!;
  return { outcome: { passedAtOnce: false, restartConceptId: last.conceptId, form: last.form } };
}

export type Group = { conceptId: string; records: ChildRecord[] };

// Group time for concept gaps (taught but not learned): children not yet probed, by the concept they
// failed; and confirmed children, by the concept they restart from (their probe's, or else their root).
// `buddies` follow both languages and can sit with a group.
export function groupTime(data: ClassData): { probe: Group[]; reteach: Group[]; buddies: Child[] } {
  const all = results(data, content);
  const records = data.children.map((child) => childRecord(child, data, content, all));
  const probe = new Map<string, ChildRecord[]>();
  const reteach = new Map<string, ChildRecord[]>();
  const add = (groups: Map<string, ChildRecord[]>, conceptId: string, record: ChildRecord) => {
    const group = groups.get(conceptId) ?? [];
    if (!group.includes(record)) groups.set(conceptId, [...group, record]);
  };
  for (const record of records) {
    for (const [conceptId, c] of Object.entries(record.concepts)) {
      if (c.label?.placement !== "taught_not_learned") continue;
      if (!c.label.confirmed) {
        add(probe, conceptId, record);
        continue;
      }
      const probed = data.probes.filter((p) => p.childId === record.child.id && p.conceptId === conceptId).at(-1);
      add(reteach, probed?.restartConceptId ?? record.root(conceptId), record);
    }
  }
  const list = (groups: Map<string, ChildRecord[]>) => [...groups].map(([conceptId, records]) => ({ conceptId, records }));
  return { probe: list(probe), reteach: list(reteach), buddies: buddies(records) };
}

// The kit speaks Bhili when most of the group is best retaught in Bhili, and Hindi otherwise.
export function kitLanguage(records: ChildRecord[]): Language {
  const count = (reteachIn: ChildRecord["language"]["reteachIn"]) => records.filter((r) => r.language.reteachIn === reteachIn).length;
  const home = count("home");
  return home > 0 && home >= count("mixed") && home >= count("school") ? "bhili" : "hindi";
}
