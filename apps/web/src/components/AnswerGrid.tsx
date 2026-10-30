import type { Child } from "@triveni/core";
import { Input } from "@/components/ui/input";
import { type GridReads, type GridValues, isFlagged, type Version, versionsFor } from "@/check";
import { cn } from "@/lib/utils";

// The box symbols children draw on their slates: each always means the same version.
export const symbols: Record<Version, string> = { A: "○", B: "△", C: "□" };

const columns = "grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem] items-center gap-2";

// One row per child, in roll order. Boxes read from slate photos with low confidence are flagged,
// and so are the names in `flaggedRows` (rolls missing from the photos or on two slates).
// Children absent today have no boxes.
export function AnswerGrid({
  roster,
  values,
  reads,
  flaggedRows,
  absent,
  onChange,
}: {
  roster: Child[];
  values: GridValues;
  reads: GridReads;
  flaggedRows: Set<string>;
  absent: Set<string>;
  onChange: (values: GridValues, reads: GridReads) => void;
}) {
  // Tapping or editing a box read from a photo counts as the teacher checking it.
  const reviewed = (childId: string, version: Version): GridReads => {
    const read = reads[childId]?.[version];
    return read ? { ...reads, [childId]: { ...reads[childId], [version]: { ...read, reviewed: true } } } : reads;
  };
  const set = (childId: string, version: Version, value: string) =>
    onChange(
      { ...values, [childId]: { ...values[childId], [version]: value.replace(/\D/g, "") } },
      reviewed(childId, version),
    );

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
        if (absent.has(child.id)) {
          return (
            <div key={child.id} className={cn(columns, "text-muted-foreground")}>
              <span className="text-lg">{child.rollNo}</span>
              <span className="col-span-4 truncate">{child.name}: absent today</span>
            </div>
          );
        }
        const versions = versionsFor(child);
        return (
          <div key={child.id} className={columns}>
            <span className="text-lg">{child.rollNo}</span>
            <span className={cn("truncate", flaggedRows.has(child.id) && "font-semibold text-amber-700")}>
              {child.name}
            </span>
            {(["A", "B", "C"] as const).map((v) =>
              versions.includes(v) ? (
                <Input
                  key={v}
                  aria-label={`${child.name} ${v}`}
                  inputMode="numeric"
                  className={cn(
                    "h-11 text-center text-lg",
                    isFlagged(reads[child.id]?.[v]) && "border-amber-500 bg-amber-50 ring-2 ring-amber-400",
                  )}
                  value={values[child.id]?.[v] ?? ""}
                  onClick={() => isFlagged(reads[child.id]?.[v]) && onChange(values, reviewed(child.id, v))}
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
