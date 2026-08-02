import { describe, expect, it } from "vitest";
import { normalizeIssuance } from "../../data-pipeline/normalizers/issuance-normalizer.js";
import type { RawDocument } from "../../data-pipeline/types.js";

const doc: RawDocument = {
  sourceUrl: "https://example.test/rmc-85-2023",
  retrievedAt: "2026-08-02T00:00:00Z",
  rawHash: "bb".repeat(32),
  text: [
    "REVENUE MEMORANDUM CIRCULAR NO. 85-2023",
    "SUBJECT: Clarifying the Final Withholding Tax on Cash and Property Dividends",
    "",
    "Pursuant to Section 24(B)(2) of the National Internal Revenue Code, the",
    "final withholding tax on cash and property dividends shall be fifteen",
    "percent (15%) of the amount of the dividend.",
    "",
    "All concerned are hereby enjoined to be guided accordingly.",
  ].join("\n"),
};

describe("normalizeIssuance", () => {
  it("detects type + reference number from the BIR header", () => {
    const rec = normalizeIssuance(doc);
    expect(rec.issuanceType).toBe("Revenue Memorandum Circular");
    expect(rec.referenceNo).toBe("RMC 85-2023");
    expect(rec.agency).toBe("BIR");
  });

  it("derives the title from the SUBJECT line", () => {
    const rec = normalizeIssuance(doc);
    expect(rec.title).toBe("Clarifying the Final Withholding Tax on Cash and Property Dividends");
  });

  it("chunks the body into passages and hashes it", () => {
    const rec = normalizeIssuance(doc);
    expect(rec.passages.length).toBeGreaterThan(0);
    expect(rec.passages[0]!.body).toContain("final withholding tax");
    expect(rec.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("respects explicit overrides", () => {
    const rec = normalizeIssuance(doc, { agency: "BIR-OVERRIDE", referenceNo: "RR 8-2018" });
    expect(rec.agency).toBe("BIR-OVERRIDE");
    expect(rec.referenceNo).toBe("RR 8-2018");
  });

  it("parses an ISO date when present in the text", () => {
    const dated = { ...doc, text: "Issued 2023-06-01\nREVENUE REGULATIONS NO. 8-2018\nbody" };
    const rec = normalizeIssuance(dated);
    expect(rec.issueDate).toBe("2023-06-01");
    expect(rec.issuanceType).toBe("Revenue Regulations");
    expect(rec.referenceNo).toBe("RR 8-2018");
  });
});
