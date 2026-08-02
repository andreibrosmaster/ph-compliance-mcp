import { describe, expect, it } from "vitest";
import { chunkIntoPassages } from "../../data-pipeline/chunkers/passage-chunker.js";

describe("chunkIntoPassages", () => {
  it("packs paragraphs into numbered passages under maxChars", () => {
    const paras = Array.from({ length: 5 }, (_, i) => `Paragraph ${i + 1}. `.repeat(20));
    const passages = chunkIntoPassages(paras.join("\n\n"), { maxChars: 200 });
    expect(passages.length).toBeGreaterThan(1);
    expect(passages[0]!.passageNo).toBe(1);
    for (const p of passages) {
      expect(p.body.length).toBeLessThanOrEqual(210);
      expect(p.passageNo).toBe(passages.indexOf(p) + 1);
    }
  });

  it("returns empty for empty input", () => {
    expect(chunkIntoPassages("   ")).toEqual([]);
  });

  it("splits a single oversized paragraph without losing text", () => {
    const huge = "Word word word word. ".repeat(500);
    const passages = chunkIntoPassages(huge, { maxChars: 100 });
    const totalWords = passages.reduce((n, p) => n + (p.body.match(/Word/g)?.length ?? 0), 0);
    expect(passages.length).toBeGreaterThan(1);
    expect(totalWords).toBe(500);
  });

  it("numbers passages sequentially across flushes", () => {
    const passages = chunkIntoPassages("A. ".repeat(50) + "\n\nB. ".repeat(50), { maxChars: 60 });
    const numbers = passages.map((p) => p.passageNo);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });
});
