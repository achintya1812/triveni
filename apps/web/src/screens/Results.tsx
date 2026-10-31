import { concepts, keywords, questions, stories } from "@triveni/content";
import type { Check, ClassRecord, Concept, Placement, Question } from "@triveni/core";
import { useState } from "react";
import { SpeakButton } from "@/components/ClipButton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useClassData } from "@/classData";
import { groupOrder, type Placed, placedOnRow } from "@/results";

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const questionFor = (id: string) => questions.find((q) => q.id === id)!;
const conceptFor = (q: Question) => concepts.find((c) => c.id === q.conceptId)!;

export const groupLabels: Record<Placement, string> = {
  language_gap: "Language gap",
  word_problem_gap: "Word-problem gap",
  symbol_gap: "Symbol gap",
  language_symbol_gap: "Language and symbol gap",
  never_taught: "Never taught (absent)",
  taught_not_learned: "Taught but not learned",
  clip_failed: "Bhili clip not followed",
  inconsistent: "Inconsistent",
  unclear: "Unclear",
  not_checked: "Not checked yet (absent today)",
  ready: "Ready",
};

const checkLabel = (check: Check) =>
  `${formatDate(check.date)}${check.kind === "recheck" ? " (re-check)" : ""}: ${check.questionIds.map((id) => conceptFor(questionFor(id)).name).join(", ")}`;

// The groups for one saved check, row by row, with what to do for each.
export function Results({ klass }: { klass: ClassRecord }) {
  const data = useClassData(klass.id);
  const [checkId, setCheckId] = useState("");
  if (!data) return null;
  // Oldest first; on the same day a weekly check comes after its re-checks, so it opens by default.
  const checks = [...data.checks].sort((x, y) => x.date.localeCompare(y.date) || (x.kind === "weekly" ? 1 : 0) - (y.kind === "weekly" ? 1 : 0));
  if (checks.length === 0) return <p className="text-muted-foreground">No checks saved yet. Run one in the Check tab.</p>;
  const check = checks.find((c) => c.id === checkId) ?? checks.at(-1)!;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="results-check">Check</Label>
        <NativeSelect id="results-check" className="w-full [&_select]:h-11" value={check.id} onChange={(e) => setCheckId(e.target.value)}>
          {checks.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {checkLabel(c)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {check.questionIds.map((id, i) => (
        <Row key={id} question={questionFor(id)} placed={placedOnRow(data, check, i + 1)} heading={check.questionIds.length > 1} />
      ))}
    </div>
  );
}

function Row({ question, placed, heading }: { question: Question; placed: Placed[]; heading: boolean }) {
  const concept = conceptFor(question);
  const bhiliHome = placed.filter((p) => p.child.homeLanguage === "bhili");
  const clipFailed = bhiliHome.filter((p) => p.placement === "clip_failed").length;
  return (
    <div className="space-y-4">
      {heading && <h2 className="text-lg font-semibold">{concept.name}</h2>}
      {bhiliHome.length > 0 && clipFailed / bhiliHome.length >= 0.3 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {clipFailed} of {bhiliHome.length} Bhili-speaking children followed the Hindi question but not the Bhili one. The
          Bhili clip may be unclear: listen to it again, and ask a Bhili speaker to check it.
        </p>
      )}
      {groupOrder.map((placement) => {
        const group = placed.filter((p) => p.placement === placement);
        if (group.length === 0) return null;
        return (
          <section key={placement} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">
              {groupLabels[placement]} ({group.length})
            </h3>
            <ul className="space-y-1">
              {group.map((p) => (
                <li key={p.child.id}>
                  {p.child.name}
                  {p.pending && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {p.pending === "recheck" ? "seen once: re-check" : "to confirm with the probe"}
                    </span>
                  )}
                  {p.notes.map((n) => (
                    <span key={n} className="block text-sm text-muted-foreground">
                      {n}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <WhatToDo placement={placement} concept={concept} question={question} />
          </section>
        );
      })}
    </div>
  );
}

function KeywordCard({ question }: { question: Question }) {
  return (
    <div className="space-y-3">
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
}

function Stories({ concept }: { concept: Concept }) {
  return (
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
  );
}

function WhatToDo({ placement, concept, question }: { placement: Placement; concept: Concept; question: Question }) {
  switch (placement) {
    case "language_gap":
      return (
        <div className="space-y-2">
          <p>Teach these Hindi words first, with the Bhili audio:</p>
          <KeywordCard question={question} />
        </div>
      );
    case "word_problem_gap":
      return (
        <div className="space-y-2">
          <p>Practise these stories: turn each one into a sum.</p>
          <Stories concept={concept} />
        </div>
      );
    case "symbol_gap":
      return (
        <div className="space-y-2">
          <p>They follow the story but not the sum. Solve a story together, then write the sum that matches it.</p>
          <Stories concept={concept} />
        </div>
      );
    case "language_symbol_gap":
      return (
        <div className="space-y-2">
          <p>First teach the Hindi words, with the Bhili audio:</p>
          <KeywordCard question={question} />
          <p>Then solve these stories together and write the sum for each:</p>
          <Stories concept={concept} />
        </div>
      );
    case "never_taught":
      return (
        <div className="space-y-2">
          <p>They were absent when this was taught. Recap the lesson on {concept.name} with them in group time.</p>
          <Button variant="outline" className="h-11 w-full" disabled>
            Send catch-up to parents (comes with Telegram)
          </Button>
        </div>
      );
    case "taught_not_learned":
      return (
        <div className="space-y-2">
          <p>Run the step-down probe in group time to find where to restart. Until then, use real objects:</p>
          <p className="text-sm text-muted-foreground">{concept.reteach.english}</p>
          <SpeakButton text={concept.reteach.bhili} label="Play reteaching (Bhili)" />
        </div>
      );
    case "clip_failed":
      return <p>They followed the Hindi but not the Bhili. Their language profile now leans to Hindi.</p>;
    case "inconsistent":
      return <p>The pattern looks like a guess or a copied answer. No label: the next check decides.</p>;
    case "unclear":
      return <p>Some boxes were blank or copied from the question. The next check decides.</p>;
    case "not_checked":
      return <p>Absent today, but present when this was taught. Include them in the next check.</p>;
    case "ready":
      return <p>Move on.</p>;
  }
}
