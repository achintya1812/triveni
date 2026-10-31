import { concepts, keywords, questions, stories } from "@triveni/content";
import type { Check, Child, ClassRecord, Concept, Placement, Question } from "@triveni/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SpeakButton } from "@/components/ClipButton";
import { InfoButton } from "@/components/InfoButton";
import { SendToParents } from "@/components/SendToParents";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useClassData } from "@/classData";
import { useUiLanguage } from "@/i18n";
import { groupOrder, type Note, type Placed, placedOnRow } from "@/results";

const questionFor = (id: string) => questions.find((q) => q.id === id)!;
const conceptFor = (q: Question) => concepts.find((c) => c.id === q.conceptId)!;

// The groups for one saved check, one concept (row) and one group at a time, with what to do for each.
export function Results({ klass }: { klass: ClassRecord }) {
  const { t } = useTranslation("results");
  const { conceptName, formatDate } = useUiLanguage();
  const data = useClassData(klass.id);
  const [checkId, setCheckId] = useState("");
  const [row, setRow] = useState(0);
  if (!data) return null;
  // Oldest first; on the same day a weekly check comes after its re-checks, so it opens by default.
  const checks = [...data.checks].sort((x, y) => x.date.localeCompare(y.date) || (x.kind === "weekly" ? 1 : 0) - (y.kind === "weekly" ? 1 : 0));
  if (checks.length === 0) return <p className="text-muted-foreground">{t("noChecks")}</p>;
  const check = checks.find((c) => c.id === checkId) ?? checks.at(-1)!;
  const checkLabel = (c: Check) =>
    `${formatDate(c.date)}${c.kind === "recheck" ? t("recheckSuffix") : ""}: ${c.questionIds.map((id) => conceptName(questionFor(id).conceptId)).join(", ")}`;
  const rowIndex = row < check.questionIds.length ? row : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="results-check">{t("check")}</Label>
          <InfoButton title={t("howTitle")} text={t("how")} />
        </div>
        <NativeSelect id="results-check" className="w-full [&_select]:h-11" value={check.id} onChange={(e) => setCheckId(e.target.value)}>
          {checks.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {checkLabel(c)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {/* One tab per concept (row) in the check. */}
      {check.questionIds.length > 1 && (
        <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
          {check.questionIds.map((id, i) => (
            <Button
              key={id}
              variant={i === rowIndex ? "outline" : "ghost"}
              className="h-auto min-h-11 whitespace-normal py-2"
              aria-pressed={i === rowIndex}
              onClick={() => setRow(i)}
            >
              {conceptName(questionFor(id).conceptId)}
            </Button>
          ))}
        </div>
      )}
      <Row question={questionFor(check.questionIds[rowIndex])} placed={placedOnRow(data, check, rowIndex + 1)} />
    </div>
  );
}

// One row: a menu of the groups that have children, and the chosen group with what to do.
function Row({ question, placed }: { question: Question; placed: Placed[] }) {
  const { t } = useTranslation("results");
  const [chosen, setChosen] = useState<Placement | null>(null);
  const concept = conceptFor(question);
  const bhiliHome = placed.filter((p) => p.child.homeLanguage === "bhili");
  const clipFailed = bhiliHome.filter((p) => p.placement === "clip_failed").length;
  const groups = groupOrder.filter((g) => placed.some((p) => p.placement === g));
  // The first group that needs help opens by default; a choice is kept when another row has the same group.
  const placement = chosen && groups.includes(chosen) ? chosen : groups[0];
  if (!placement) return null;
  const group = placed.filter((p) => p.placement === placement);
  // "B: wrote 22, added instead of subtracted".
  const note = (n: Note) =>
    n.cause === "copied"
      ? t("notes.copied", { version: n.version, value: n.value })
      : t("notes.wrote", { version: n.version, value: n.value, meaning: t(`causes.${n.cause}`) });
  return (
    <div className="space-y-4">
      {bhiliHome.length > 0 && clipFailed / bhiliHome.length >= 0.3 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t("clipWarning", { failed: clipFailed, total: bhiliHome.length })}</p>
      )}
      <nav className="grid grid-cols-2 gap-2" aria-label={t("groupsMenu")}>
        {groups.map((g) => (
          <Button
            key={g}
            variant={g === placement ? "default" : "outline"}
            className="h-auto min-h-11 justify-between gap-2 whitespace-normal py-2 text-left"
            aria-pressed={g === placement}
            onClick={() => setChosen(g)}
          >
            <span>{t(`groups.${g}`)}</span>
            <span className="tabular-nums">{placed.filter((p) => p.placement === g).length}</span>
          </Button>
        ))}
      </nav>
      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">
            {t(`groups.${placement}`)} ({group.length})
          </h3>
          <InfoButton title={t(`groups.${placement}`)} text={t(`about.${placement}`)} />
        </div>
        <ul className="space-y-1">
          {group.map((p) => (
            <li key={p.child.id}>
              {p.child.name}
              {p.pending && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t(`pending.${p.pending}`)}</span>
              )}
              {p.notes.map((n) => (
                <span key={n.version} className="block text-sm text-muted-foreground">
                  {note(n)}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <WhatToDo placement={placement} concept={concept} question={question} children={group.map((p) => p.child)} />
      </section>
    </div>
  );
}

function KeywordCard({ question }: { question: Question }) {
  const { t } = useTranslation("results");
  const { language } = useUiLanguage();
  return (
    <div className="space-y-3">
      {keywords
        .filter((k) => question.keywordIds.includes(k.id))
        .map((k) => (
          <div key={k.id} className="space-y-2 rounded-md border p-3">
            <p>
              <span className="text-2xl font-semibold">{k.hindi}</span>{" "}
              {/* The English gloss helps only an English reader; in Hindi the word speaks for itself. */}
              {language === "en" && (
                <span className="text-muted-foreground">
                  {k.roman}: "{k.meaning}"
                </span>
              )}
            </p>
            <SpeakButton text={k.bhili} label={t("common:playInBhili")} />
          </div>
        ))}
    </div>
  );
}

function Stories({ concept }: { concept: Concept }) {
  const { t } = useTranslation("results");
  const { language } = useUiLanguage();
  return (
    <ol className="list-decimal space-y-2 pl-5">
      {stories
        .filter((s) => s.conceptId === concept.id)
        .map((s) => (
          <li key={s.id}>
            <p>{s.hindi}</p>
            <p className="text-sm text-muted-foreground">
              {language === "en" && `${s.english} `}({t("todo.answer", { answer: s.answer })})
            </p>
          </li>
        ))}
    </ol>
  );
}

function WhatToDo({
  placement,
  concept,
  question,
  children,
}: {
  placement: Placement;
  concept: Concept;
  question: Question;
  children: Child[];
}) {
  const { t } = useTranslation("results");
  const { language, conceptName } = useUiLanguage();
  switch (placement) {
    case "language_gap":
      return (
        <div className="space-y-2">
          <p>{t("todo.languageGap")}</p>
          <KeywordCard question={question} />
        </div>
      );
    case "word_problem_gap":
      return (
        <div className="space-y-2">
          <p>{t("todo.wordProblem")}</p>
          <Stories concept={concept} />
        </div>
      );
    case "symbol_gap":
      return (
        <div className="space-y-2">
          <p>{t("todo.symbol")}</p>
          <Stories concept={concept} />
        </div>
      );
    case "language_symbol_gap":
      return (
        <div className="space-y-2">
          <p>{t("todo.languageSymbolWords")}</p>
          <KeywordCard question={question} />
          <p>{t("todo.languageSymbolStories")}</p>
          <Stories concept={concept} />
        </div>
      );
    case "never_taught":
      return (
        <div className="space-y-2">
          <p>{t("todo.neverTaught", { concept: conceptName(concept.id) })}</p>
          <SendToParents kind="catch_up" conceptId={concept.id} children={children} label={t("todo.sendCatchUp")} />
        </div>
      );
    case "taught_not_learned":
      return (
        <div className="space-y-2">
          <p>{t("todo.taughtNotLearned")}</p>
          {/* The reteaching script is in English and Bhili only; in Hindi the Bhili audio carries it. */}
          {language === "en" && <p className="text-sm text-muted-foreground">{concept.reteach.english}</p>}
          <SpeakButton text={concept.reteach.bhili} label={t("todo.playReteach")} />
        </div>
      );
    case "clip_failed":
      return <p>{t("todo.clipFailed")}</p>;
    case "inconsistent":
      return <p>{t("todo.inconsistent")}</p>;
    case "unclear":
      return <p>{t("todo.unclear")}</p>;
    case "not_checked":
      return <p>{t("todo.notChecked")}</p>;
    case "ready":
      return <p>{t("todo.ready")}</p>;
  }
}
