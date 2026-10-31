import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { db, flush, onOutboxProblem, readWaitingNotes } from "./db";
import { setLanguage } from "./i18n";
import { Brief } from "./screens/Brief";
import { CheckRunner } from "./screens/CheckRunner";
import { ClassScreen } from "./screens/ClassScreen";
import { DailyLog } from "./screens/DailyLog";
import { Results } from "./screens/Results";
import { Setup } from "./screens/Setup";

// One teacher and one class: set it up once, then read the morning brief, log each day, run checks, see the results
// and look after the class (its language profiles and listening check).
export default function App() {
  const { t, i18n } = useTranslation();
  const classes = useLiveQuery(() => db.classes.toArray());
  const [error, setError] = useState("");
  // Writes and voice notes waiting for a signal.
  const waiting = useLiveQuery(async () => (await db.outbox.count()) + (await db.notes.count())) ?? 0;

  // Sends what's waiting: on start, when the signal returns, and every 30 seconds in case it returned unnoticed.
  useEffect(() => {
    const sendWaiting = () => flush().then(readWaitingNotes);
    sendWaiting();
    window.addEventListener("online", sendWaiting);
    const timer = setInterval(sendWaiting, 30_000);
    const stop = onOutboxProblem(setError);
    return () => {
      window.removeEventListener("online", sendWaiting);
      clearInterval(timer);
      stop();
    };
  }, []);
  const [screen, setScreen] = useState<"brief" | "log" | "check" | "results" | "class">("brief");

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("app")}</h1>
        {waiting > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900" role="status">
            ⏳ {t("pending", { count: waiting })}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={() => setLanguage(i18n.language === "hi" ? "en" : "hi")}>
          {t("switchTo")}
        </Button>
      </div>
      {error && (
        <button className="w-full rounded-lg bg-destructive/10 p-3 text-left text-sm text-destructive" onClick={() => setError("")}>
          {t("notSent", { error })}
        </button>
      )}
      {classes && !classes[0] && <Setup onError={setError} />}
      {classes?.[0] && (
        <>
          <nav className="grid grid-cols-5 gap-1">
            {(["brief", "log", "check", "results", "class"] as const).map((id) => (
              <Button key={id} variant={screen === id ? "default" : "outline"} className="h-11 px-1 text-xs" onClick={() => setScreen(id)}>
                {t(`nav.${id}`)}
              </Button>
            ))}
          </nav>
          {screen === "brief" && <Brief klass={classes[0]} onError={setError} />}
          {screen === "log" && <DailyLog klass={classes[0]} onError={setError} />}
          {screen === "check" && <CheckRunner klass={classes[0]} onError={setError} />}
          {screen === "results" && <Results klass={classes[0]} />}
          {screen === "class" && <ClassScreen klass={classes[0]} onError={setError} />}
        </>
      )}
    </main>
  );
}
