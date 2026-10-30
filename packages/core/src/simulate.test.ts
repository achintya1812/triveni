import { describe, expect, it } from "vitest";
import { causes, defaultOptions, simulate } from "./simulate";

// A guard on the rules as a whole: if a change stops them finding planted causes, this fails.
describe("simulate", () => {
  const options = { ...defaultOptions, classes: 20 };
  const rows = simulate(options);

  it("plants every cause", () => {
    expect(rows.map((r) => r.cause)).toEqual(causes);
    expect(rows.reduce((sum, r) => sum + r.children, 0)).toBe(20 * options.childrenPerClass);
  });

  it("finds most planted causes, and labels few children wrongly", () => {
    for (const r of rows) {
      expect(r.found / r.children, r.cause).toBeGreaterThan(0.7);
      expect(r.wrongLabel / r.children, r.cause).toBeLessThan(0.12);
    }
  });

  it("finds every cause when nobody slips", () => {
    const clean = simulate({ ...options, careless: 0, blank: 0, absence: 0 });
    for (const r of clean) {
      expect(r.found, r.cause).toBe(r.children);
      expect(r.wrongLabel, r.cause).toBe(0);
      expect(r.checksToFind.every((n) => n === 1), r.cause).toBe(true); // on the first check that covers it
    }
  });

  it("repeats exactly with the same seed", () => {
    expect(simulate(options)).toEqual(rows);
  });
});
