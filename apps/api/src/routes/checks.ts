import { Answer, Check, ListeningResult, ProbeResult } from "@triveni/core";
import { Hono } from "hono";
import { db } from "../db";
import { camel, json, run, snake } from "../http";

// Checks and their answers, probe results and the listening check.
export const checks = new Hono()
  .post("/classes/:id/checks", json(Check.omit({ classId: true })), async (c) => {
    const check = { ...c.req.valid("json"), classId: c.req.param("id") };
    await run(db().from("checks").upsert(snake(check)));
    return c.json(check, 201);
  })
  .get("/classes/:id/checks", async (c) => {
    const rows = await run(db().from("checks").select().eq("class_id", c.req.param("id")).order("date"));
    return c.json(Check.array().parse(rows.map(camel)));
  })
  .post("/checks/:id/answers", json(Answer.omit({ checkId: true }).array()), async (c) => {
    const answers = c.req.valid("json").map((answer) => ({ ...answer, checkId: c.req.param("id") }));
    await run(db().from("answers").upsert(answers.map(snake)));
    return c.json(answers, 201);
  })
  .get("/checks/:id/answers", async (c) => {
    const rows = await run(
      db().from("answers").select().eq("check_id", c.req.param("id")).order("child_id").order("row").order("version"),
    );
    return c.json(Answer.array().parse(rows.map(camel)));
  })

  .post("/classes/:id/probes", json(ProbeResult.omit({ classId: true })), async (c) => {
    const result = { ...c.req.valid("json"), classId: c.req.param("id") };
    await run(db().from("probe_results").upsert(snake(result)));
    return c.json(result, 201);
  })
  .get("/classes/:id/probes", async (c) => {
    const rows = await run(db().from("probe_results").select().eq("class_id", c.req.param("id")).order("date"));
    return c.json(ProbeResult.array().parse(rows.map(camel)));
  })

  .post("/classes/:id/listening", json(ListeningResult.omit({ classId: true }).array()), async (c) => {
    const results = c.req.valid("json").map((result) => ({ ...result, classId: c.req.param("id") }));
    await run(db().from("listening_results").upsert(results.map(snake)));
    return c.json(results, 201);
  })
  .get("/classes/:id/listening", async (c) => {
    const rows = await run(
      db().from("listening_results").select().eq("class_id", c.req.param("id")).order("child_id").order("item_id"),
    );
    return c.json(ListeningResult.array().parse(rows.map(camel)));
  });
