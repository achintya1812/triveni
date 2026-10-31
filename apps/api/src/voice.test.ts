import { describe, expect, it } from "vitest";
import { conceptForPage, findPage } from "./voice";

describe("findPage", () => {
  it("finds a page number after a page word, in English or Hindi, in either script's digits", () => {
    expect(findPage("आज borrowing पढ़ाया page 65।")).toBe(65);
    expect(findPage("आज बोरोइंग पढ़ाया पेज 65।")).toBe(65);
    expect(findPage("पृष्ठ संख्या ६२ से घटाना")).toBe(62);
    expect(findPage("Page no. 59")).toBe(59);
  });

  it("finds no page in a note without one, or with the number only in words", () => {
    expect(findPage("आज बच्चों को दहाई खोलकर घटाना सिखाया")).toBeNull();
    expect(findPage("आज 13 तीलियों से घटाना सिखाया")).toBeNull();
    expect(findPage("आज बोरोइंग पढ़ाया पेज पैंसठ")).toBeNull();
  });
});

describe("conceptForPage", () => {
  it("matches a page to the concept whose textbook pages include it", () => {
    expect(conceptForPage(65)).toBe("borrowing");
    expect(conceptForPage(62)).toBe("two-digit-subtraction");
    expect(conceptForPage(5)).toBeNull();
  });
});
