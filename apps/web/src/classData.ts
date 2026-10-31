import { concepts, keywords, questions } from "@triveni/content";
import type { ClassData, Content } from "@triveni/core";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

export const content: Content = { concepts, questions, keywords };

// Everything Dexie holds for the class, as the rules engine takes it. Updates live.
export function useClassData(classId: string): ClassData | undefined {
  return useLiveQuery(async () => {
    const checks = await db.checks.where({ classId }).toArray();
    return {
      children: await db.children.where({ classId }).sortBy("rollNo"),
      checks,
      answers: await db.answers.where("checkId").anyOf(checks.map((c) => c.id)).toArray(),
      lessons: await db.lessons.where({ classId }).toArray(),
      attendance: await db.attendance.where({ classId }).toArray(),
      probes: await db.probeResults.where({ classId }).toArray(),
      listening: await db.listeningResults.where({ classId }).toArray(),
    };
  }, [classId]);
}
