import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL("./locales/", import.meta.url);
const read = (language: string, file: string) => JSON.parse(readFileSync(new URL(`${language}/${file}`, dir), "utf8"));

// Every key path in a namespace, such as "voice.hold".
const keys = (o: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe("locales", () => {
  const files = readdirSync(new URL("en/", dir));

  it("has the same namespaces in Hindi and English", () => {
    expect(readdirSync(new URL("hi/", dir)).sort()).toEqual(files.sort());
  });

  it.each(files)("has the same keys in Hindi and English: %s", (file) => {
    expect(keys(read("hi", file)).sort()).toEqual(keys(read("en", file)).sort());
  });

  it.each(files)("has no empty Hindi text: %s", (file) => {
    const empty = (o: Record<string, unknown>): boolean =>
      Object.values(o).some((v) => (typeof v === "object" && v ? empty(v as Record<string, unknown>) : v === ""));
    expect(empty(read("hi", file))).toBe(false);
  });
});
