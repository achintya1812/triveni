import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { db } from "./db";
import { CheckRunner } from "./screens/CheckRunner";
import { DailyLog } from "./screens/DailyLog";
import { Setup } from "./screens/Setup";

// The MVP has one teacher and one class: set it up once, then log each day and run checks.
export default function App() {
  const classes = useLiveQuery(() => db.classes.toArray());
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<"log" | "check">("log");

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
          <nav className="grid grid-cols-2 gap-2">
            <Button variant={screen === "log" ? "default" : "outline"} className="h-11" onClick={() => setScreen("log")}>
              Daily log
            </Button>
            <Button variant={screen === "check" ? "default" : "outline"} className="h-11" onClick={() => setScreen("check")}>
              Check
            </Button>
          </nav>
          {screen === "log" ? (
            <DailyLog klass={classes[0]} onError={setError} />
          ) : (
            <CheckRunner klass={classes[0]} onError={setError} />
          )}
        </>
      )}
    </main>
  );
}
