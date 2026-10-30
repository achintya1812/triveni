import type { PostgrestError } from "@supabase/supabase-js";
import { validator } from "hono/validator";
import type { z } from "zod";

// Shared by the route files. Writes are upserts, so the phone can safely send the same record again.

export const snake = (o: object) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`), v]));
export const camel = (o: object) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_([a-z])/g, (_, m: string) => m.toUpperCase()), v]));

export function json<T extends z.ZodType>(schema: T) {
  return validator("json", (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    return parsed.data as z.output<T>;
  });
}

// Supabase returns errors rather than throwing them; throw so onError can pick a status.
export async function run(query: PromiseLike<{ data: unknown; error: PostgrestError | null }>) {
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return (data ?? []) as Record<string, unknown>[];
}
