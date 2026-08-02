import { describe, expect, it } from "vitest";
import { DOMAIN_MODULES } from "../../src/domains/index.js";
import {
  catalogByActNumber,
  catalogByDomain,
  catalogById,
  catalogDomains,
  INSTRUMENT_CATALOG,
  validateCatalog,
} from "../../data-pipeline/catalog.js";

describe("instrument catalog", () => {
  it("catalogs instruments across all 15 domains", () => {
    const domains = catalogDomains();
    expect(domains.length).toBeGreaterThanOrEqual(15);
    for (const m of DOMAIN_MODULES) {
      expect(domains).toContain(m.slug);
    }
  });

  it("has no duplicate ids or act numbers and only known domains", () => {
    expect(validateCatalog(DOMAIN_MODULES)).toEqual([]);
  });

  it("resolves canonical act numbers", () => {
    expect(catalogByActNumber("386")?.id).toBe("civil-code");
    expect(catalogByActNumber("442")?.id).toBe("labor-code");
    expect(catalogByActNumber("851")?.id).toBe("13th-month-pay");
    expect(catalogByActNumber("11199")?.id).toBe("sss-act-2018");
  });

  it("covers the compliance domains added by ADR-004", () => {
    expect(catalogByDomain("payroll").length).toBeGreaterThan(0);
    expect(catalogByDomain("accounting").length).toBeGreaterThan(0);
    expect(catalogByDomain("human-resources").length).toBeGreaterThan(0);
    expect(catalogByDomain("business-transactional").length).toBeGreaterThan(0);
  });

  it("every entry has a stable id and https source URL", () => {
    for (const e of INSTRUMENT_CATALOG) {
      expect(e.id).toMatch(/^[a-z0-9-]+$/);
      expect(e.sourceUrl.startsWith("https://")).toBe(true);
      expect(catalogById(e.id)?.id).toBe(e.id);
    }
  });
});
