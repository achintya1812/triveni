import { Roster } from "@triveni/core";
import { Hono } from "hono";
import { z } from "zod";
import { json } from "../http";
import { readSlates } from "../slates";

// One photo of several slates, base64, already resized on the phone, with the class list and the number of rows.
export const slates = new Hono().post(
  "/slates/read",
  json(
    z.object({
      image: z.base64().min(1).max(8_000_000),
      mediaType: z.enum(["image/jpeg", "image/png"]),
      roster: Roster.min(1),
      rows: z.number().int().min(1).max(2),
    }),
  ),
  async (c) => {
    const { image, mediaType, roster, rows } = c.req.valid("json");
    return c.json(await readSlates(image, mediaType, roster, rows));
  },
);
