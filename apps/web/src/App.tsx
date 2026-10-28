import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "./db";
import { DailyLog } from "./screens/DailyLog";
import { Setup } from "./screens/Setup";

// The MVP has one teacher and one class: set it up once, then log each day.
export default function App() {
  const classes = useLiveQuery(() => db.classes.toArray());
  const [error, setError] = useState("");

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Triveni</h1>
      {error && (
        <button className="w-full rounded-lg bg-destructive/10 p-3 text-left text-sm text-destructive" onClick={() => setError("")}>
          Saved on this phone, but not sent to the server: {error}. Tap to dismiss.
        </button>
      )}
      {classes && (classes[0] ? <DailyLog klass={classes[0]} onError={setError} /> : <Setup onError={setError} />)}
    </main>
  );
}
