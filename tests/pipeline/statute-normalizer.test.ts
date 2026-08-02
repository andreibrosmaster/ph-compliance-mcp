import { describe, expect, it } from "vitest";
import {
  normalizeWhitespace,
  segmentProvisions,
  normalizeStatute,
} from "../../data-pipeline/normalizers/statute-normalizer.js";

describe("normalizeWhitespace", () => {
  it("collapses CRLF, multiple spaces, and triple newlines", () => {
    const input = "Art. 1.\r\n  Body   text.\r\n\r\n\r\nNext.";
    expect(normalizeWhitespace(input)).toBe("Art. 1.\nBody text.\n\nNext.");
  });
});

describe("segmentProvisions", () => {
  const CODAL = `PRELIMINARY TITLE
Art. 1. This Act shall be known as the Civil Code.

Art. 2. Laws shall take effect after fifteen days.

SECTION 3. Ignorance of the law excuses no one from compliance.`;

  it("splits article-style provisions", () => {
    const blocks = segmentProvisions(CODAL);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.number).toBe("1");
    expect(blocks[0]?.heading).toBe("This Act shall be known as the Civil Code.");
    expect(blocks[0]?.body).toContain("known as the Civil Code");
    expect(blocks[1]?.number).toBe("2");
    expect(blocks[2]?.number).toBe("3");
  });

  it("keeps body lines until next heading", () => {
    const blocks = segmentProvisions("Art. 1. Heading.\nLine one.\nLine two.\n\nArt. 2. Next.");
    expect(blocks[0]?.body).toBe("Heading.\nLine one.\nLine two.");
  });
});

describe("normalizeStatute", () => {
  it("produces a StatuteRecord with provenance and hash", () => {
    const rec = normalizeStatute(
      { sourceUrl: "https://example.test/law", retrievedAt: "2026-08-02T00:00:00Z", text: "Art. 1. A.\n\nArt. 2. B.", rawHash: "x" },
      { shortTitle: "Test Code", officialTitle: "Test Code of 2026", kind: "code", domain: "civil" },
    );
    expect(rec.shortTitle).toBe("Test Code");
    expect(rec.provisions).toHaveLength(2);
    expect(rec.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rec.sourceUrl).toBe("https://example.test/law");
  });
});
