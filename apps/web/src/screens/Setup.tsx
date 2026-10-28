import { Child, ClassRecord, type Language } from "@triveni/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { saveClass } from "@/db";
import { loadDemo } from "@/seed";

interface Row {
  id: string;
  rollNo: string;
  name: string;
  homeLanguage: Language;
}

const newRow = (rollNo: number): Row => ({
  id: crypto.randomUUID(),
  rollNo: String(rollNo),
  name: "",
  homeLanguage: "bhili",
});

export function Setup({ onError }: { onError: (message: string) => void }) {
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("2");
  const [rows, setRows] = useState<Row[]>([newRow(1)]);
  const [invalid, setInvalid] = useState("");

  const update = (i: number, change: Partial<Row>) =>
    setRows(rows.map((row, j) => (j === i ? { ...row, ...change } : row)));

  async function save() {
    const classId = crypto.randomUUID();
    const klass = ClassRecord.safeParse({ id: classId, school: school.trim(), grade: Number(grade) });
    const children = Child.array().safeParse(
      rows.map((r) => ({ ...r, classId, rollNo: Number(r.rollNo), name: r.name.trim() })),
    );
    if (!klass.success) return setInvalid("Enter the school name.");
    if (!children.success) return setInvalid("Every child needs a roll number and a name.");
    if (new Set(children.data.map((c) => c.rollNo)).size !== children.data.length) {
      return setInvalid("Two children have the same roll number.");
    }
    setInvalid("");
    await saveClass(klass.data, children.data).catch((e: Error) => onError(e.message));
  }

  return (
    <div className="space-y-6">
      <Button size="lg" variant="outline" className="h-12 w-full" onClick={() => loadDemo().catch((e: Error) => onError(e.message))}>
        Load demo class
      </Button>

      <div className="space-y-2">
        <Label htmlFor="school">School</Label>
        <Input id="school" className="h-11" value={school} onChange={(e) => setSchool(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="grade">Grade</Label>
        <NativeSelect id="grade" className="w-full [&_select]:h-11" value={grade} onChange={(e) => setGrade(e.target.value)}>
          {["1", "2", "3"].map((g) => (
            <NativeSelectOption key={g} value={g}>
              Grade {g}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <Label>Children</Label>
        {rows.map((row, i) => (
          <div key={row.id} className="flex gap-2">
            <Input
              aria-label="Roll number"
              inputMode="numeric"
              className="h-11 w-16"
              value={row.rollNo}
              onChange={(e) => update(i, { rollNo: e.target.value })}
            />
            <Input
              aria-label="Name"
              placeholder="Name"
              className="h-11"
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <NativeSelect
              aria-label="Home language"
              className="[&_select]:h-11"
              value={row.homeLanguage}
              onChange={(e) => update(i, { homeLanguage: e.target.value as Language })}
            >
              <NativeSelectOption value="bhili">Bhili</NativeSelectOption>
              <NativeSelectOption value="hindi">Hindi</NativeSelectOption>
            </NativeSelect>
          </div>
        ))}
        <Button variant="outline" className="h-11 w-full" onClick={() => setRows([...rows, newRow(rows.length + 1)])}>
          Add child
        </Button>
      </div>

      {invalid && <p className="text-sm text-destructive">{invalid}</p>}
      <Button className="h-12 w-full" onClick={save}>
        Save class
      </Button>
    </div>
  );
}
