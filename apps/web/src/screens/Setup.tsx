import { Child, ClassRecord, type Language } from "@triveni/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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

const newRow = (rows: Row[]): Row => ({
  id: crypto.randomUUID(),
  rollNo: String(Math.max(0, ...rows.map((r) => Number(r.rollNo) || 0)) + 1),
  name: "",
  homeLanguage: "bhili",
});

// Sets up the class, or with `klass` and `children`, edits it: the same children keep their ids and records.
export function Setup({
  klass: current,
  children: existing = [],
  onDone,
  onError,
}: {
  klass?: ClassRecord;
  children?: Child[];
  onDone?: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation("setup");
  const [school, setSchool] = useState(current?.school ?? "");
  const [grade, setGrade] = useState(String(current?.grade ?? 2));
  const [rows, setRows] = useState<Row[]>(() =>
    existing.length > 0 ? existing.map((c) => ({ ...c, rollNo: String(c.rollNo) })) : [newRow([])],
  );
  const [invalid, setInvalid] = useState("");

  const update = (i: number, change: Partial<Row>) =>
    setRows(rows.map((row, j) => (j === i ? { ...row, ...change } : row)));

  async function save() {
    const classId = current?.id ?? crypto.randomUUID();
    const klass = ClassRecord.safeParse({ id: classId, school: school.trim(), grade: Number(grade) });
    // An edited child keeps what the form doesn't show, such as the parent's Telegram opt-in.
    const children = Child.array().safeParse(
      rows.map((r) => ({ ...existing.find((c) => c.id === r.id), ...r, classId, rollNo: Number(r.rollNo), name: r.name.trim() })),
    );
    if (!klass.success) return setInvalid(t("enterSchool"));
    if (!children.success) return setInvalid(t("rollAndName"));
    if (new Set(children.data.map((c) => c.rollNo)).size !== children.data.length) {
      return setInvalid(t("sameRoll"));
    }
    setInvalid("");
    await saveClass(klass.data, children.data).catch((e: Error) => onError(e.message));
    onDone?.();
  }

  return (
    <div className="space-y-6">
      {current ? (
        <h2 className="font-semibold">{t("editTitle")}</h2>
      ) : (
        <Button size="lg" variant="outline" className="h-12 w-full" onClick={() => loadDemo().catch((e: Error) => onError(e.message))}>
          {t("loadDemo")}
        </Button>
      )}

      <div className="space-y-2">
        <Label htmlFor="school">{t("school")}</Label>
        <Input id="school" className="h-11" value={school} onChange={(e) => setSchool(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="grade">{t("grade")}</Label>
        <NativeSelect id="grade" className="w-full [&_select]:h-11" value={grade} onChange={(e) => setGrade(e.target.value)}>
          {["1", "2", "3"].map((g) => (
            <NativeSelectOption key={g} value={g}>
              {t("gradeOption", { grade: g })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <Label>{t("children")}</Label>
        {rows.map((row, i) => (
          <div key={row.id} className="flex gap-2">
            <Input
              aria-label={t("rollNumber")}
              inputMode="numeric"
              className="h-11 w-16 shrink-0"
              value={row.rollNo}
              onChange={(e) => update(i, { rollNo: e.target.value })}
            />
            <Input
              aria-label={t("name")}
              placeholder={t("name")}
              className="h-11"
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <NativeSelect
              aria-label={t("homeLanguage")}
              className="shrink-0 [&_select]:h-11"
              value={row.homeLanguage}
              onChange={(e) => update(i, { homeLanguage: e.target.value as Language })}
            >
              <NativeSelectOption value="bhili">{t("common:languages.bhili")}</NativeSelectOption>
              <NativeSelectOption value="hindi">{t("common:languages.hindi")}</NativeSelectOption>
            </NativeSelect>
          </div>
        ))}
        <Button variant="outline" className="h-11 w-full" onClick={() => setRows([...rows, newRow(rows)])}>
          {t("addChild")}
        </Button>
      </div>

      {invalid && <p className="text-sm text-destructive">{invalid}</p>}
      <Button className="h-12 w-full" onClick={save}>
        {current ? t("saveChanges") : t("saveClass")}
      </Button>
      {onDone && (
        <Button variant="outline" className="h-12 w-full" onClick={onDone}>
          {t("common:cancel")}
        </Button>
      )}
    </div>
  );
}
