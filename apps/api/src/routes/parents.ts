import { ParentMessage } from "@triveni/core";
import { Hono } from "hono";
import { db } from "../db";
import { camel, json, run, snake } from "../http";

// The record of voice notes sent to parents. Stage 22 adds sending them on Telegram.
export const parents = new Hono()
  .post("/classes/:id/parent-messages", json(ParentMessage.omit({ classId: true })), async (c) => {
    const message = { ...c.req.valid("json"), classId: c.req.param("id") };
    await run(db().from("parent_messages").upsert(snake(message)));
    return c.json(message, 201);
  })
  .get("/classes/:id/parent-messages", async (c) => {
    const rows = await run(db().from("parent_messages").select().eq("class_id", c.req.param("id")).order("sent_at"));
    return c.json(ParentMessage.array().parse(rows.map(camel)));
  });
