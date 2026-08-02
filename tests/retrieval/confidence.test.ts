import { describe, expect, it } from "vitest";
import { passesGate, queryTerms, scoreConfidence } from "../../src/retrieval/confidence.js";
import { loadConfig } from "../../src/config.js";

describe("scoreConfidence", () => {
  it("scores a strong exact-phrase match as high", () => {
    const c = scoreConfidence({
      bm25Score: -8,
      termCoverage: 1,
      exactPhrase: true,
      headingMatch: false,
    });
    expect(c.score).toBeGreaterThanOrEqual(0.7);
    expect(c.level).toBe("high");
  });

  it("scores a weak partial match as low", () => {
    const c = scoreConfidence({
      bm25Score: -1,
      termCoverage: 0.2,
      exactPhrase: false,
      headingMatch: false,
    });
    expect(c.score).toBeLessThan(0.4);
    expect(c.level).toBe("low");
  });

  it("clamps to [0,1]", () => {
    const c = scoreConfidence({ bm25Score: -100, termCoverage: 1, exactPhrase: true, headingMatch: true });
    expect(c.score).toBeLessThanOrEqual(1);
  });
});

describe("passesGate", () => {
  it("respects the configured threshold", () => {
    const strict = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.9" });
    const loose = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.1" });
    const c = scoreConfidence({ bm25Score: -5, termCoverage: 0.8, exactPhrase: true, headingMatch: false });
    expect(passesGate(c, strict)).toBe(false);
    expect(passesGate(c, loose)).toBe(true);
  });
});

describe("queryTerms", () => {
  it("normalizes terms", () => {
    expect(queryTerms('Waiver, "public policy"!')).toEqual(["waiver", "public", "policy"]);
  });
});
