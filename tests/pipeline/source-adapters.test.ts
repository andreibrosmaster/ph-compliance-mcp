import { describe, expect, it } from "vitest";
import { INSTRUMENT_CATALOG } from "../../data-pipeline/catalog.js";
import { SOURCE_ADAPTERS, adapterById } from "../../data-pipeline/sources/types.js";
import { catalogTargetsFor, mapCatalogKind } from "../../data-pipeline/sources/targets.js";
import { extractArticle, LAWPHIL_SELECTORS, OG_SELECTORS } from "../../data-pipeline/sources/extract.js";
import { OFFICIAL_GAZETTE_BASE } from "../../data-pipeline/sources/official-gazette.js";
import { LAWPHIL_BASE } from "../../data-pipeline/sources/lawphil.js";

describe("source adapter registry", () => {
  it("registers the reference adapters by stable id", () => {
    expect(SOURCE_ADAPTERS.map((a) => a.id).sort()).toEqual(["lawphil", "official-gazette"]);
    expect(adapterById("official-gazette")?.name).toContain("Official Gazette");
    expect(adapterById("lawphil")?.baseUrl).toBe(LAWPHIL_BASE);
    expect(adapterById("nope")).toBeUndefined();
  });

  it("every catalogued instrument has a https source URL", () => {
    for (const e of INSTRUMENT_CATALOG) {
      expect(e.sourceUrl.startsWith("https://")).toBe(true);
    }
  });

  it("selects catalog targets by base URL without network", () => {
    const og = catalogTargetsFor(OFFICIAL_GAZETTE_BASE);
    const lp = catalogTargetsFor(LAWPHIL_BASE);
    expect(og.length).toBeGreaterThan(0);
    expect(lp.length).toBeGreaterThan(0);
    for (const e of og) expect(e.sourceUrl.startsWith(OFFICIAL_GAZETTE_BASE)).toBe(true);
    for (const e of lp) expect(e.sourceUrl.startsWith(LAWPHIL_BASE)).toBe(true);
    // Every catalogued instrument is reachable through one of the reference
    // adapters, or is a documented third-party official host (SC E-Library).
    const union = new Set([...og, ...lp].map((e) => e.sourceUrl));
    const uncovered = INSTRUMENT_CATALOG.filter((e) => !union.has(e.sourceUrl));
    expect(uncovered.map((e) => e.id)).toEqual(["rules-of-court"]);
    expect(uncovered[0]?.sourceUrl.startsWith("https://elibrary.judiciary.gov.ph/")).toBe(true);
  });

  it("maps catalog kinds onto the statutes-table kind union", () => {
    expect(mapCatalogKind("act")).toBe("act");
    expect(mapCatalogKind("rules")).toBe("rules");
    expect(mapCatalogKind("republic_act")).toBe("republic_act");
  });
});

describe("html extraction", () => {
  const fixture = `
    <html><head><title>x</title></head><body>
      <nav>menu link</nav>
      <h1 class="entry-title">Republic Act No. 386</h1>
      <article class="entry-content">
        <p>The Civil Code of the Philippines shall govern obligations and contracts.</p>
        <p>Article 1156. An obligation is a juridical necessity to give, to do, or not to do.</p>
      </article>
      <footer>footer junk</footer>
    </body></html>`;

  it("extracts the main article body and title for Official Gazette selectors", () => {
    const { title, text } = extractArticle(fixture, OG_SELECTORS);
    expect(title).toBe("Republic Act No. 386");
    expect(text).toContain("juridical necessity");
    expect(text).not.toContain("menu link");
    expect(text).not.toContain("footer junk");
  });

  it("falls back to body text when no selector matches", () => {
    const { text } = extractArticle("<html><body><p>Only a paragraph here, but long enough to pass the floor.</p></body></html>", ["no-such-selector"]);
    expect(text).toContain("Only a paragraph");
  });

  it("keeps LawPhil selector list as a valid non-empty array", () => {
    expect(LAWPHIL_SELECTORS.length).toBeGreaterThan(0);
  });
});
