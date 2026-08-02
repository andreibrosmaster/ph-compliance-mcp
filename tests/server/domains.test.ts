import { describe, expect, it } from "vitest";
import {
  allDomainModules,
  DOMAIN_MODULES,
  getDomain,
  validateRegistry,
} from "../../src/domains/index.js";

describe("domain registry", () => {
  it("has the 15-domain compliance taxonomy (ADR-000 core + ADR-004 expansion)", () => {
    expect(DOMAIN_MODULES).toHaveLength(15);
    expect(getDomain("tax")?.name).toBe("Tax Law");
    expect(getDomain("constitutional")?.name).toBe("Constitutional Law");
    expect(getDomain("payroll")?.name).toBe("Payroll & Benefits Law");
    expect(getDomain("accounting")?.name).toBe("Accounting & Auditing Law");
    expect(getDomain("human-resources")?.name).toBe("Human Resources & Workplace Compliance");
    expect(getDomain("business-transactional")?.name).toBe("Business & Transactional Law");
  });

  it("has no duplicate slugs and no dangling cross-ref targets", () => {
    expect(validateRegistry()).toEqual([]);
  });

  it("every module has a source and a refresh cadence", () => {
    for (const m of DOMAIN_MODULES) {
      expect(m.sources.length).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(m.refreshCadence);
      expect(m.keyInstruments.length).toBeGreaterThan(0);
    }
  });

  it("every module has cross-references registered", () => {
    const modules = allDomainModules();
    for (const { crossRefs } of modules) {
      expect(crossRefs.length).toBeGreaterThan(0);
    }
  });

  it("every cross-reference target resolves to a registered slug", () => {
    const slugs = new Set(DOMAIN_MODULES.map((m) => m.slug));
    for (const { crossRefs } of allDomainModules()) {
      for (const ref of crossRefs) {
        expect(slugs.has(ref.target)).toBe(true);
      }
    }
  });
});
