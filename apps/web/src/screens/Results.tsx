import { concepts, keywords, questions, stories } from "@triveni/content";
import { buildBrief, type Check, type ClassRecord, type Concept, type Placement, type Question } from "@triveni/core";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { SpeakButton } from "@/components/ClipButton";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, db } from "@/db";
import { groupOrder, type Placed, placeChildren } from "@/results";

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const groupLabels: Record<Placement, string> = {
  language_gap: "Language gap",
  word_problem_gap: "Word-problem gap",
  never_taught: "Never taught (absent)",
  taught_not_learned: "Taught but not learned",
  symbol_gap: "Symbol gap",
  language_symbol_gap: "Language and symbol gap",
  clip_failed: "Bhili clip not followed",
  inconsistent: "Inconsistent",
  not_checked: "Not checked yet (absent today)",
  unclear: "Unclear",
  ready: "Ready",
};

const checkName = (check: Check) =>
  check.questionIds
    .map((id) => concepts.find((c) => c.id === questions.find((q) => q.id === id)?.conceptId)?.name)
    .join(", ");

// The groups for one saved check, what to do for each, and the morning brief.
export function Results({ klass }: { klass: ClassRecord }) {
  const checks = useLiveQuery(() => db.checks.where({ classId: klass.id }).sortBy("date"), [klass.id]);
  const [checkId, setCheckId] = useState("");
  const check = checks?.find((c) => c.id === checkId) ?? checks?.at(-1);

  const records = useLiveQuery(async () => {
    if (!check) return;
    return {
      children: await db.children.where({ classId: klass.id }).sortBy("rollNo"),
      answers: await db.answers.where({ checkId: check.id }).toArray(),
      lessons: await db.lessons.where({ classId: klass.id }).toArray(),
      attendance: await db.attendance.where({ classId: klass.id }).toArray(),
    };
  }, [klass.id, check?.id]);

  if (checks?.length === 0) return <p className="text-muted-foreground">No checks saved yet. Run one in the Check tab.</p>;
  if (!check || !records) return null;

  // Until Stage 14, a check has one concept, so one question.
  const question = questions.find((q) => q.id === check.questionIds[0])!;
  const concept = concepts.find((c) => c.id === question.conceptId)!;
  const placed = placeChildren(
    question,
    records.children,
    records.answers,
    records.lessons,
    records.attendance,
    check.date,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="results-check">Check</Label>
        <NativeSelect
          id="results-check"
          className="w-full [&_select]:h-11"
          value={check.id}
          onChange={(e) => setCheckId(e.target.value)}
        >
          {checks!.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {formatDate(c.date)}: {checkName(c)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <Brief concept={concept} question={question} placed={placed} />

      {groupOrder.map((placement) => {
        const names = placed.filter((p) => p.placement === placement).map((p) => p.child.name);
        if (names.length === 0) return null;
        return (
          <section key={placement} className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">
              {groupLabels[placement]} ({names.length})
            </h2>
            <p>{names.join(", ")}</p>
            <WhatToDo placement={placement} concept={concept} question={question} />
          </section>
        );
      })}
    </div>
  );
}

// The template brief straight away, then Claude's rewording if it arrives.
function Brief({ concept, question, placed }: { concept: Concept; question: Question; placed: Placed[] }) {
  const template = buildBrief({
    conceptName: concept.name,
    keywords: keywords.filter((k) => question.keywordIds.includes(k.id)),
    children: placed.map((p) => ({ name: p.child.name, placement: p.placement })),
  });
  const [reworded, setReworded] = useState<{ template: string; text: string }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setFailed(false);
    api("POST", "/brief/reword", { brief: template })
      .then((res) => res.json() as Promise<{ brief: string }>)
      .then(({ brief }) => current && setReworded({ template, text: brief }))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [template]);

  // A rewording of an older template is stale once the answers change.
  const text = reworded?.template === template ? reworded.text : undefined;
  return (
    <section className="space-y-2 rounded-lg bg-muted p-4">
      <h2 className="font-semibold">Morning brief</h2>
      <p className="whitespace-pre-line">{text ?? template}</p>
      <p className="text-xs text-muted-foreground">
        {text ? "Reworded by Claude." : failed ? "Couldn't reach Claude, so this is the template." : "Rewording…"}
      </p>
    </section>
  );
}

function WhatToDo({ placement, concept, question }: { placement: Placement; concept: Concept; question: Question }) {
  switch (placement) {
    case "language_gap":
      return (
        <div className="space-y-3">
          <p>Teach these Hindi words first, with the Bhili audio:</p>
          {keywords
            .filter((k) => question.keywordIds.includes(k.id))
            .map((k) => (
              <div key={k.id} className="space-y-2 rounded-md border p-3">
                <p>
                  <span className="text-2xl font-semibold">{k.hindi}</span>{" "}
                  <span className="text-muted-foreground">
                    {k.roman}: "{k.meaning}"
                  </span>
                </p>
                <SpeakButton text={k.bhili} label="Play in Bhili" />
              </div>
            ))}
        </div>
      );
    case "word_problem_gap":
      return (
        <div className="space-y-2">
          <p>Practise these stories: turn each one into a sum.</p>
          <ol className="list-decimal space-y-2 pl-5">
            {stories
              .filter((s) => s.conceptId === concept.id)
              .map((s) => (
                <li key={s.id}>
                  <p>{s.hindi}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.english} (Answer: {s.answer})
                  </p>
                </li>
              ))}
          </ol>
        </div>
      );
    case "never_taught":
      return <p>They were absent when this was taught. Recap the lesson on {concept.name}.</p>;
    case "taught_not_learned":
      return (
        <div className="space-y-2">
          <p>Use real objects, and play the Bhili reteaching clip while you show each step:</p>
          <p className="text-sm text-muted-foreground">{concept.reteach.english}</p>
          <SpeakButton text={concept.reteach.bhili} label="Play reteaching (Bhili)" />
        </div>
      );
    // Stage 15 fills in the full actions for these.
    case "symbol_gap":
      return <p>They follow the story but not the sum. Solve a story, then write the sum that matches it.</p>;
    case "language_symbol_gap":
      return <p>Teach the Hindi key words first, then practise turning stories into sums.</p>;
    case "clip_failed":
      return <p>Hindi worked but the Bhili clip didn't. If many children are here, the clip may be unclear.</p>;
    case "inconsistent":
      return <p>The pattern looks like a guess or a copied answer. The next check decides.</p>;
    case "not_checked":
      return <p>Absent today. Include them in the next check.</p>;
    case "unclear":
      return <p>Some boxes were blank or copied from the question. Check again next time.</p>;
    case "ready":
      return <p>Move on.</p>;
  }
}
