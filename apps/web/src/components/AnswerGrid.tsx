import type { Child } from "@triveni/core";
import { Input } from "@/components/ui/input";
import { type GridValues, type Version, versionsFor } from "@/check";

// The box symbols children draw on their slates: each always means the same version.
export const symbols: Record<Version, string> = { A: "○", B: "△", C: "□" };

const columns = "grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem] items-center gap-2";

// One row per child, in roll order. Kept separate so Stage 7 can fill it from slate photos.
export function AnswerGrid({
  roster,
  values,
  onChange,
}: {
  roster: Child[];
  values: GridValues;
  onChange: (values: GridValues) => void;
}) {
  const set = (childId: string, version: Version, value: string) =>
    onChange({ ...values, [childId]: { ...values[childId], [version]: value.replace(/\D/g, "") } });

  return (
    <div className="space-y-2">
      <div className={`${columns} text-sm font-medium text-muted-foreground`}>
        <span>Roll</span>
        <span>Name</span>
        {(["A", "B", "C"] as const).map((v) => (
          <span key={v} className="text-center">
            {symbols[v]} {v}
          </span>
        ))}
      </div>
      {roster.map((child) => {
        const versions = versionsFor(child);
        return (
          <div key={child.id} className={columns}>
            <span className="text-lg">{child.rollNo}</span>
            <span className="truncate">{child.name}</span>
            {(["A", "B", "C"] as const).map((v) =>
              versions.includes(v) ? (
                <Input
                  key={v}
                  aria-label={`${child.name} ${v}`}
                  inputMode="numeric"
                  className="h-11 text-center text-lg"
                  value={values[child.id]?.[v] ?? ""}
                  onChange={(e) => set(child.id, v, e.target.value)}
                />
              ) : (
                <span key={v} className="text-center text-xs text-muted-foreground" title="Hindi at home: no C">
                  —
                </span>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}
