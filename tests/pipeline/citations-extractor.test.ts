import { describe, expect, it } from "vitest";
import { extractCitations, normalizeTitleHint } from "../../data-pipeline/citations/extractor.js";

const SAMPLE = [
  "The Court cited Art. 1156, Civil Code, on the definition of obligation.",
  "See G.R. No. 238875, People v. Dela Cruz.",
  "Under Sec. 5(b) of Republic Act No. 9165, the penalty is life imprisonment.",
  "Art. VIII, Sec. 13 of the 1987 Constitution vests judicial power.",
  "The IRR of RA 10173 governs data processing.",
  "This follows our ruling in G.R. No. L-12345.",
].join("\n");

describe("extractCitations", () => {
  it("extracts case citations (modern and L-prefixed)", () => {
    const spans = extractCitations(SAMPLE);
    const cases = spans.filter((s) => s.kind === "case");
    expect(cases.map((c) => c.caseCitation)).toContain("G.R. No. 238875");
    expect(cases.map((c) => c.caseCitation)).toContain("G.R. No. L-12345");
  });

  it("extracts provision-level statute citations with title hints", () => {
    const spans = extractCitations(SAMPLE);
    const prov = spans.find((s) => s.kind === "statute" && s.provisionNo === "1156");
    expect(prov?.statuteTitle).toContain("Civil Code");
  });

  it("extracts act-number statute citations", () => {
    const spans = extractCitations(SAMPLE);
    const ra = spans.find((s) => s.kind === "statute" && s.actNumber === "9165");
    expect(ra).toBeTruthy();
  });

  it("lifts the act number out of provision title hints", () => {
    const spans = extractCitations("Under Sec. 5(b) of Republic Act No. 9165, the penalty is life imprisonment.");
    const prov = spans.find((s) => s.kind === "statute" && s.provisionNo === "5(B)");
    expect(prov?.actNumber).toBe("9165");
    expect(prov?.statuteTitle).toContain("Republic Act");
  });

  it("extracts constitution citations with provision No.", () => {
    const spans = extractCitations(SAMPLE);
    const consti = spans.find((s) => s.kind === "statute" && s.statuteTitle === "1987 Constitution");
    expect(consti?.provisionNo).toBe("VIII-13");
  });

  it("extracts IRR references", () => {
    const spans = extractCitations(SAMPLE);
    const irr = spans.find((s) => s.kind === "statute" && s.actNumber === "10173" && s.statuteTitle?.includes("IRR"));
    expect(irr).toBeTruthy();
  });

  it("normalizes known code titles", () => {
    expect(normalizeTitleHint("the Civil Code of the Philippines")).toBe("Civil Code of the Philippines");
    expect(normalizeTitleHint("Revised Penal Code")).toBe("Revised Penal Code");
  });

  it("deduplicates identical raw spans", () => {
    const text = "Art. 1156, Civil Code. Art. 1156, Civil Code.";
    const spans = extractCitations(text);
    const raws = spans.map((s) => s.raw);
    expect(new Set(raws).size).toBe(raws.length);
  });
});
