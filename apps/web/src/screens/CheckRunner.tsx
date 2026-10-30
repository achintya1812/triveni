import { concepts, questions } from "@triveni/content";
import type { Check, Child, ClassRecord, SlateReading } from "@triveni/core";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { AnswerGrid, symbols } from "@/components/AnswerGrid";
import { ClipButton, SpeakButton } from "@/components/ClipButton";
import { SlatePhotos } from "@/components/SlatePhotos";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { applySlates, type GridReads, type GridValues, isFlagged, markGrid, rollFlags } from "@/check";
import { db, saveCheck } from "@/db";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

// The MVP check: one concept, fixed order A, B, C. Rotating the order is out of scope.
export function CheckRunner({ klass, onError }: { klass: ClassRecord; onError: (message: string) => void }) {
  const [conceptId, setConceptId] = useState("");
  const [checkId, setCheckId] = useState(() => crypto.randomUUID());
  const [grid, setGrid] = useState<{ values: GridValues; reads: GridReads }>({ values: {}, reads: {} });
  const [rolls, setRolls] = useState<(number | null)[]>([]); // every roll number read from a photo
  const [saved, setSaved] = useState(false);

  const children = useLiveQuery(() => db.children.where({ classId: klass.id }).sortBy("rollNo"), [klass.id]);
  const question = questions.find((q) => q.conceptId === conceptId);

  // A different concept is a different check.
  function pickConcept(id: string) {
    setConceptId(id);
    setCheckId(crypto.randomUUID());
    setGrid({ values: {}, reads: {} });
    setRolls([]);
    setSaved(false);
  }

  function readPhoto(reading: SlateReading) {
    if (!children) return;
    setSaved(false);
    setGrid((g) => applySlates(children, g.values, g.reads, reading));
    setRolls((r) => [...r, ...reading.slates.map((s) => s.roll)]);
  }

  async function save() {
    if (!question || !children) return;
    const check: Check = {
      id: checkId,
      classId: klass.id,
      date: today(),
      questionIds: [question.id],
      kind: "weekly",
      versionOrder: ["A", "B", "C"],
      childIds: null,
    };
    try {
      await saveCheck(check, markGrid(check.id, question, children, grid.values, grid.reads));
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
            <p className="text-sm text-muted-foreground">
              Photograph five to eight slates at a time, or type the answers. Leave a box empty if the child left it
              blank.
            </p>
            <SlatePhotos onRead={readPhoto} />
            {children && <PhotoFlags roster={children} reads={grid.reads} rolls={rolls} />}
            {children && (
              <AnswerGrid
                roster={children}
                values={grid.values}
                reads={grid.reads}
                flaggedRows={flaggedRows(children, rolls)}
                onChange={(values, reads) => {
                  setSaved(false);
                  setGrid({ values, reads });
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

const flaggedRows = (roster: Child[], rolls: (number | null)[]) => {
  const { missing, duplicate } = rollFlags(roster, rolls);
  return new Set([...missing, ...duplicate].map((c) => c.id));
};

const rollList = (children: Child[]) => children.map((c) => `${c.rollNo} ${c.name}`).join(", ");

// What the teacher needs to check after reading photos.
function PhotoFlags({ roster, reads, rolls }: { roster: Child[]; reads: GridReads; rolls: (number | null)[] }) {
  if (rolls.length === 0) return null;
  const { unreadable, unknown, duplicate, missing } = rollFlags(roster, rolls);
  const boxes = Object.values(reads).flatMap((r) => Object.values(r)).filter(isFlagged).length;
  const notes = [
    boxes > 0 && `${boxes} highlighted ${boxes === 1 ? "box needs" : "boxes need"} checking. Tap each one, and fix it if it's wrong.`,
    missing.length > 0 && `No slate found for roll ${rollList(missing)}. Photograph them again, or type their answers.`,
    duplicate.length > 0 &&
      `More than one slate says roll ${rollList(duplicate)}. The last photo's answers are shown, so check whose slate is whose.`,
    unknown.length > 0 && `Roll ${unknown.join(", ")} isn't in this class.`,
    unreadable > 0 && `${unreadable} ${unreadable === 1 ? "slate's" : "slates'"} roll number couldn't be read. Photograph again.`,
  ].filter(Boolean);
  if (notes.length === 0) return <p className="text-sm text-muted-foreground">Every slate was read clearly.</p>;
  return (
    <ul className="list-disc space-y-1 rounded-lg bg-amber-50 p-3 pl-7 text-sm text-amber-900">
      {notes.map((note) => (
        <li key={note as string}>{note}</li>
      ))}
    </ul>
  );
}
