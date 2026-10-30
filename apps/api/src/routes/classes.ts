import { Attendance, Child, ClassRecord, Lesson } from "@triveni/core";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { camel, json, run, snake } from "../http";

// The class, its children, attendance and lessons.
export const classes = new Hono()
  .post("/classes", json(ClassRecord), async (c) => {
    const record = c.req.valid("json");
    await run(db().from("classes").upsert(snake(record)));
    return c.json(record, 201);
  })
  .get("/classes/:id", async (c) => {
    const [row] = await run(db().from("classes").select().eq("id", c.req.param("id")));
    if (!row) return c.json({ error: "Class not found" }, 404);
    return c.json(ClassRecord.parse(camel(row)));
  })

  .post("/classes/:id/children", json(Child.omit({ classId: true }).array()), async (c) => {
    const children = c.req.valid("json").map((child) => ({ ...child, classId: c.req.param("id") }));
    await run(db().from("children").upsert(children.map(snake)));
    return c.json(children, 201);
  })
  .get("/classes/:id/children", async (c) => {
    const rows = await run(db().from("children").select().eq("class_id", c.req.param("id")).order("roll_no"));
    return c.json(Child.array().parse(rows.map(camel)));
  })

  // Writes a row for every child in the class: present unless listed.
  .put("/classes/:id/attendance/:date", json(z.object({ absentChildIds: z.array(z.uuid()) })), async (c) => {
    const { id, date } = c.req.param();
    if (!z.iso.date().safeParse(date).success) return c.json({ error: "Date must be YYYY-MM-DD" }, 400);
    const { absentChildIds } = c.req.valid("json");
    const childIds = (await run(db().from("children").select("id").eq("class_id", id))).map((r) => r.id as string);
    if (absentChildIds.some((childId) => !childIds.includes(childId))) {
      return c.json({ error: "An absent child is not in this class" }, 400);
    }
    const rows: Attendance[] = childIds.map((childId) => ({
      classId: id,
      date,
      childId,
      present: !absentChildIds.includes(childId),
    }));
    await run(db().from("attendance").upsert(rows.map(snake)));
    return c.json(rows);
  })
  .get("/classes/:id/attendance", async (c) => {
    const rows = await run(db().from("attendance").select().eq("class_id", c.req.param("id")).order("date"));
    return c.json(Attendance.array().parse(rows.map(camel)));
  })

  .post("/classes/:id/lessons", json(Lesson.omit({ classId: true })), async (c) => {
    const lesson = { ...c.req.valid("json"), classId: c.req.param("id") };
    await run(db().from("lessons").upsert(snake(lesson)));
    return c.json(lesson, 201);
  })
  // When the teacher clears a day's concept, so the rules no longer count it as taught.
  .delete("/classes/:id/lessons/:lessonId", async (c) => {
    const { id, lessonId } = c.req.param();
    await run(db().from("lessons").delete().eq("id", lessonId).eq("class_id", id));
    return c.body(null, 204);
  })
  .get("/classes/:id/lessons", async (c) => {
    const rows = await run(db().from("lessons").select().eq("class_id", c.req.param("id")).order("date"));
    return c.json(Lesson.array().parse(rows.map(camel)));
  });
