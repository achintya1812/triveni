import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { brief } from "./routes/brief";
import { checks } from "./routes/checks";
import { classes } from "./routes/classes";
import { parents } from "./routes/parents";
import { slates } from "./routes/slates";
import { speak } from "./routes/speak";
import { voice } from "./routes/voice";

// No auth: one teacher and one demo class. Each area's routes live in src/routes.

// Postgres codes: malformed uuid, unknown class/child/check, duplicate roll number.
const statusForCode: Record<string, 400 | 409> = { "22P02": 400, "23503": 400, "23505": 409 };

export const app = new Hono()
  // WEB_ORIGIN is the deployed web app's address, for example https://triveni.vercel.app.
  .use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }))
  .get("/health", (c) => c.json({ ok: true }))
  .route("/", classes)
  .route("/", checks)
  .route("/", parents)
  .route("/", speak)
  .route("/", brief)
  .route("/", slates)
  .route("/", voice);

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  const status = statusForCode[(err as { code?: string }).code ?? ""];
  if (status) return c.json({ error: err.message }, status);
  console.error(err);
  return c.json({ error: "Server error" }, 500);
});
