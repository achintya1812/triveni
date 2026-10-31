import { concepts, keywords, questions, stories } from "@triveni/content";
import type { Check, Child, ClassRecord, Concept, Placement, Question } from "@triveni/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SpeakButton } from "@/components/ClipButton";
import { SendToParents } from "@/components/SendToParents";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useClassData } from "@/classData";
import { useUiLanguage } from "@/i18n";
import { groupOrder, type Note, type Placed, placedOnRow } from "@/results";

const questionFor = (id: string) => questions.find((q) => q.id === id)!;
const conceptFor = (q: Question) => concepts.find((c) => c.id === q.conceptId)!;

// The groups for one saved check, row by row, with what to do for each.
export function Results({ klass }: { klass: ClassRecord }) {
  const { t } = useTranslation("results");
  const { conceptName, formatDate } = useUiLanguage();
  const data = useClassData(klass.id);
  const [checkId, setCheckId] = useState("");
  if (!data) return null;
  // Oldest first; on the same day a weekly check comes after its re-checks, so it opens by default.
  const checks = [...data.checks].sort((x, y) => x.date.localeCompare(y.date) || (x.kind === "weekly" ? 1 : 0) - (y.kind === "weekly" ? 1 : 0));
  if (checks.length === 0) return <p className="text-muted-foreground">{t("noChecks")}</p>;
  const check = checks.find((c) => c.id === checkId) ?? checks.at(-1)!;
  const checkLabel = (c: Check) =>
    `${formatDate(c.date)}${c.kind === "recheck" ? t("recheckSuffix") : ""}: ${c.questionIds.map((id) => conceptName(questionFor(id).conceptId)).join(", ")}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="results-check">{t("check")}</Label>
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
  const { t } = useTranslation("results");
  const { conceptName } = useUiLanguage();
  const concept = conceptFor(question);
  const bhiliHome = placed.filter((p) => p.child.homeLanguage === "bhili");
  const clipFailed = bhiliHome.filter((p) => p.placement === "clip_failed").length;
  // "B: wrote 22, added instead of subtracted".
  const note = (n: Note) =>
    n.cause === "copied"
      ? t("notes.copied", { version: n.version, value: n.value })
      : t("notes.wrote", { version: n.version, value: n.value, meaning: t(`causes.${n.cause}`) });
  return (
    <div className="space-y-4">
      {heading && <h2 className="text-lg font-semibold">{conceptName(concept.id)}</h2>}
      {bhiliHome.length > 0 && clipFailed / bhiliHome.length >= 0.3 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t("clipWarning", { failed: clipFailed, total: bhiliHome.length })}</p>
      )}
      {groupOrder.map((placement) => {
        const group = placed.filter((p) => p.placement === placement);
        if (group.length === 0) return null;
        return (
          <section key={placement} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">
              {t(`groups.${placement}`)} ({group.length})
            </h3>
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
        );
      })}
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
