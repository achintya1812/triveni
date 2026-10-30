import { Hono } from "hono";
import { z } from "zod";
import { rewordBrief } from "../brief";
import { json } from "../http";

export const brief = new Hono().post(
  "/brief/reword",
  json(z.object({ brief: z.string().trim().min(1).max(4000), language: z.enum(["en", "hi"]).default("en") })),
  async (c) => {
    const { brief, language } = c.req.valid("json");
    return c.json({ brief: await rewordBrief(brief, language) });
  },
);
