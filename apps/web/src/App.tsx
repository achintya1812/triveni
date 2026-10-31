import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { db } from "./db";
import { Brief } from "./screens/Brief";
import { CheckRunner } from "./screens/CheckRunner";
import { ClassScreen } from "./screens/ClassScreen";
import { DailyLog } from "./screens/DailyLog";
import { Results } from "./screens/Results";
import { Setup } from "./screens/Setup";

// One teacher and one class: set it up once, then read the morning brief, log each day, run checks, see the results
// and look after the class (its language profiles and listening check).
export default function App() {
  const classes = useLiveQuery(() => db.classes.toArray());
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<"brief" | "log" | "check" | "results" | "class">("brief");

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Triveni</h1>
      {error && (
        <button className="w-full rounded-lg bg-destructive/10 p-3 text-left text-sm text-destructive" onClick={() => setError("")}>
          Saved on this phone, but not sent to the server: {error}. Tap to dismiss.
        </button>
      )}
      {classes && !classes[0] && <Setup onError={setError} />}
      {classes?.[0] && (
        <>
          <nav className="grid grid-cols-5 gap-1">
            {(
              [
                ["brief", "Brief"],
                ["log", "Daily log"],
                ["check", "Check"],
                ["results", "Results"],
                ["class", "Class"],
              ] as const
            ).map(([id, label]) => (
              <Button key={id} variant={screen === id ? "default" : "outline"} className="h-11 px-1 text-xs" onClick={() => setScreen(id)}>
                {label}
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
