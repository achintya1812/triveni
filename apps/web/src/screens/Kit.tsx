import { concepts, keywords, kits } from "@triveni/content";
import type { Child, ChildRecord, Language } from "@triveni/core";
import { useState } from "react";
import { SpeakButton } from "@/components/ClipButton";
import { SendToParents } from "@/components/SendToParents";
import { Button } from "@/components/ui/button";
import { kitLanguage } from "@/group";

const languageNames: Record<Language, string> = { bhili: "Bhili", hindi: "Hindi" };

// The reteaching kit for a group: paired steps (what the teacher does, what the audio says), the key-word
// card, a buddy and the home activity. The audio is in the language most of the group is best retaught in.
export function Kit({
  conceptId,
  records,
  buddy,
  onClose,
}: {
  conceptId: string;
  records: ChildRecord[];
  buddy: Child | undefined;
  onClose: () => void;
}) {
  const kit = kits.find((k) => k.conceptId === conceptId);
  const suggested = kitLanguage(records);
  const [language, setLanguage] = useState<Language>(suggested);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Reteaching kit: {concepts.find((c) => c.id === conceptId)!.name}</h2>
          <p className="text-sm text-muted-foreground">{records.map((r) => r.child.name).join(", ")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      {!kit && <p className="text-muted-foreground">There's no reteaching kit for this concept yet.</p>}
      {kit && (
        <>
          <section className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {(["bhili", "hindi"] as const).map((l) => (
                <Button key={l} variant={language === l ? "default" : "outline"} className="h-10" onClick={() => setLanguage(l)}>
                  Audio in {languageNames[l]}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Most of this group is best retaught in {languageNames[suggested]}.</p>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Steps</h3>
            {kit.steps.map((step, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <p>
                  {i + 1}. {step.teacherDoes.english}
                </p>
                <SpeakButton text={step.says[language]} language={language} label={`Play step ${i + 1}`} />
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Key words</h3>
            {kit.keywordIds.map((id) => {
              const k = keywords.find((w) => w.id === id)!;
              return (
                <div key={id} className="space-y-2 rounded-lg border p-3">
                  <p>
                    <span className="text-lg font-medium">{k.hindi}</span> ({k.roman}): {k.meaning}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <SpeakButton text={k.hindi} language="hindi" label="Hindi" />
                    <SpeakButton text={k.bhili} language="bhili" label="Bhili" />
                  </div>
                </div>
              );
            })}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">Buddy</h3>
            <p>
              {buddy
                ? `${buddy.name} follows both languages. Sit them with the group to repeat each step in Bhili.`
                : "No child follows both languages well enough to be a buddy yet."}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">For parents</h3>
            <p>{kit.parentActivity.english}</p>
            <SendToParents
              kind="activity"
              conceptId={conceptId}
              children={records.map((r) => r.child)}
              label="Send activity to parents"
            />
          </section>
        </>
      )}
    </div>
  );
}
