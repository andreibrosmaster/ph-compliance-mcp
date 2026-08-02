import { describe, expect, it } from "vitest";
import { normalizeNgaIssuance } from "../../data-pipeline/normalizers/nga-issuance-normalizer.js";
import type { RawDocument } from "../../data-pipeline/types.js";

function doc(text: string, overrides: Partial<RawDocument> = {}): RawDocument {
  return {
    sourceUrl: "https://example.test/issuance",
    retrievedAt: "2026-08-02T00:00:00Z",
    rawHash: "aa".repeat(32),
    text,
    ...overrides,
  };
}

describe("normalizeNgaIssuance", () => {
  it("detects a DOLE Department Order and its reference number", () => {
    // Real DOLE Department Orders carry the full agency name in the header.
    const rec = normalizeNgaIssuance(
      doc(
        "DEPARTMENT OF LABOR AND EMPLOYMENT\nDEPARTMENT ORDER NO. 223-18\nSUBJECT: Guidelines on working conditions\nBody text here.",
      ),
    );
    expect(rec.agency).toBe("DOLE");
    expect(rec.issuanceType).toBe("Department Order");
    expect(rec.referenceNo).toContain("223-18");
    expect(rec.title).toContain("Guidelines on working conditions");
  });

  it("detects an LGU ordinance", () => {
    const rec = normalizeNgaIssuance(
      doc("ORDINANCE NO. 2023-123\nAN ORDINANCE IMPOSING A BUSINESS TAX\nBe it ordained..."),
    );
    expect(rec.issuanceType).toBe("Ordinance");
    expect(rec.referenceNo).toContain("2023-123");
    expect(rec.agency).toBe("National Government Agency"); // no agency keyword
  });

  it("detects GOCC circulars via agency hints (SSS)", () => {
    const rec = normalizeNgaIssuance(
      doc("SOCIAL SECURITY SYSTEM\nCIRCULAR NO. 2023-05\nSUBJECT: Contribution schedule update"),
    );
    expect(rec.agency).toBe("SSS");
    expect(rec.issuanceType).toBe("Circular");
  });

  it("respects explicit overrides", () => {
    const rec = normalizeNgaIssuance(
      doc("SOME UNKNOWN HEADER\nbody"),
      { agency: "LGU Quezon City", issuanceType: "Memorandum Circular", referenceNo: "MC 2023-01", issueDate: "2023-01-15" },
    );
    expect(rec.agency).toBe("LGU Quezon City");
    expect(rec.issuanceType).toBe("Memorandum Circular");
    expect(rec.referenceNo).toBe("MC 2023-01");
    expect(rec.issueDate).toBe("2023-01-15");
  });

  it("chunks passages and hashes content", () => {
    const rec = normalizeNgaIssuance(doc("CIRCULAR NO. 2024-01\n".padEnd(6000, "x")));
    expect(rec.passages.length).toBeGreaterThan(1);
    expect(rec.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("treats a numberless Advisory as type-only", () => {
    const rec = normalizeNgaIssuance(doc("ADVISORY ON THE WEEKEND FILING SCHEDULE\nSUBJECT: Extended hours"));
    expect(rec.issuanceType).toBe("Advisory");
    expect(rec.referenceNo).toBe("Advisory");
  });
});
