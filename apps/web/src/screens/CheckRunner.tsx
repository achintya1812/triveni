import { concepts, questions } from "@triveni/content";
import type { ClassRecord } from "@triveni/core";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { AnswerGrid, symbols } from "@/components/AnswerGrid";
import { ClipButton, SpeakButton } from "@/components/ClipButton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { type GridValues, markGrid } from "@/check";
import { db, saveCheck } from "@/db";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

// The MVP check: one concept, fixed order A, B, C. Rotating the order is out of scope.
export function CheckRunner({ klass, onError }: { klass: ClassRecord; onError: (message: string) => void }) {
  const [conceptId, setConceptId] = useState("");
  const [checkId, setCheckId] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<GridValues>({});
  const [saved, setSaved] = useState(false);

  const children = useLiveQuery(() => db.children.where({ classId: klass.id }).sortBy("rollNo"), [klass.id]);
  const question = questions.find((q) => q.conceptId === conceptId);

  // A different concept is a different check.
  function pickConcept(id: string) {
    setConceptId(id);
    setCheckId(crypto.randomUUID());
    setValues({});
    setSaved(false);
  }

  async function save() {
    if (!question || !children) return;
    const check = { id: checkId, classId: klass.id, date: today(), conceptId };
    try {
      await saveCheck(check, markGrid(check.id, question, children, values));
      setSaved(true);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="check-concept">Concept to check</Label>
        <NativeSelect
          id="check-concept"
          className="w-full [&_select]:h-11"
          value={conceptId}
          onChange={(e) => pickConcept(e.target.value)}
        >
          <NativeSelectOption value="">Pick a concept</NativeSelectOption>
          {concepts.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {question && (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">1. Write this on the board ({symbols.A} box)</h2>
            <p className="rounded-lg border p-6 text-center text-5xl font-semibold">{question.A.prompt}</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">2. Play the Hindi question ({symbols.B} box)</h2>
            <ClipButton clipId={question.B.audio} label="Play B (Hindi)" />
            <p className="text-sm text-muted-foreground">{question.B.english}</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">3. Play the Bhili question ({symbols.C} box)</h2>
            <SpeakButton text={question.C.bhili} label="Play C (Bhili)" />
            <p className="text-sm text-muted-foreground">
              {question.C.english} Children who speak Hindi at home skip this box.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">4. Enter the answers from the slates</h2>
            <p className="text-sm text-muted-foreground">Leave a box empty if the child left it blank.</p>
            {children && (
              <AnswerGrid
                roster={children}
                values={values}
                onChange={(v) => {
                  setSaved(false);
                  setValues(v);
                }}
              />
            )}
          </section>

          <Button className="h-12 w-full" onClick={save}>
            {saved ? "Saved" : "Save answers"}
          </Button>
        </>
      )}
    </div>
  );
}
