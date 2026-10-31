import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { speechFile } from "./audio";

describe("speechFile", () => {
  it("finds a clip where the API caches it, so it plays with no signal", async () => {
    const text = "आमी 13 लाकड्या हाय.";
    const hash = createHash("sha256").update(text).digest("hex");
    expect(await speechFile(text, "bhili")).toBe(`tts/bhili/${hash}.wav`);
    expect(await speechFile(text, "hindi")).toBe(`tts/hindi/${hash}.mp3`);
  });
});
