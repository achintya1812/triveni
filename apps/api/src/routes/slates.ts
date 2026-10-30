import { Hono } from "hono";
import { z } from "zod";
import { json } from "../http";
import { readSlates } from "../slates";

// One photo of several slates, base64, already resized on the phone.
export const slates = new Hono().post(
  "/slates/read",
  json(z.object({ image: z.base64().min(1).max(8_000_000), mediaType: z.enum(["image/jpeg", "image/png"]) })),
  async (c) => {
    const { image, mediaType } = c.req.valid("json");
    return c.json(await readSlates(image, mediaType));
  },
);
