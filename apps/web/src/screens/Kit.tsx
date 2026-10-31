import { keywords, kits } from "@triveni/content";
import type { Child, ChildRecord, Language } from "@triveni/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SpeakButton } from "@/components/ClipButton";
import { SendToParents } from "@/components/SendToParents";
import { Button } from "@/components/ui/button";
import { kitLanguage } from "@/group";
import { useUiLanguage } from "@/i18n";


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
  const { t } = useTranslation("kit");
  const { language: ui, conceptName } = useUiLanguage();
  const kit = kits.find((k) => k.conceptId === conceptId);
  const suggested = kitLanguage(records);
  const [language, setLanguage] = useState<Language>(suggested);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("title", { concept: conceptName(conceptId) })}</h2>
          <p className="text-sm text-muted-foreground">{records.map((r) => r.child.name).join(", ")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("common:close")}
        </Button>
      </div>
      {!kit && <p className="text-muted-foreground">{t("none")}</p>}
      {kit && (
        <>
          <section className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {(["bhili", "hindi"] as const).map((l) => (
                <Button key={l} variant={language === l ? "default" : "outline"} className="h-10" onClick={() => setLanguage(l)}>
                  {t("audioIn", { language: t(`common:languages.${l}`) })}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{t("suggested", { language: t(`common:languages.${suggested}`) })}</p>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">{t("steps")}</h3>
            {kit.steps.map((step, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <p>
                  {i + 1}. {step.teacherDoes[ui === "hi" ? "hindi" : "english"]}
                </p>
                <SpeakButton text={step.says[language]} language={language} label={t("playStep", { n: i + 1 })} />
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">{t("keywords")}</h3>
            {kit.keywordIds.map((id) => {
              const k = keywords.find((w) => w.id === id)!;
              return (
                <div key={id} className="space-y-2 rounded-lg border p-3">
                  <p>
                    <span className="text-lg font-medium">{k.hindi}</span>
                    {ui === "en" && ` (${k.roman}): ${k.meaning}`}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <SpeakButton text={k.hindi} language="hindi" label={t("common:languages.hindi")} />
                    <SpeakButton text={k.bhili} language="bhili" label={t("common:languages.bhili")} />
                  </div>
                </div>
              );
            })}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t("buddy")}</h3>
            <p>
              {buddy ? t("buddyText", { name: buddy.name }) : t("noBuddy")}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t("parents")}</h3>
            <p>{kit.parentActivity[ui === "hi" ? "hindi" : "english"]}</p>
            <SendToParents
              kind="activity"
              conceptId={conceptId}
              children={records.map((r) => r.child)}
              label={t("send")}
            />
          </section>
        </>
      )}
    </div>
  );
}
