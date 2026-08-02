/**
 * Domain registry (blueprint §4, §8). Aggregates the 15 compliance domain
 * modules (ADR-000 core 11 + ADR-004 expansion) and their cross-references.
 * Single source of truth for domain metadata; backs `list_domains` (via
 * resources/domain-index.ts) and the graph tools.
 */
import { crossRefs as accountingCrossRefs, module as accounting } from "./accounting.js";
import { crossRefs as administrativeCrossRefs, module as administrative } from "./administrative.js";
import { crossRefs as businessCrossRefs, module as business } from "./business-transactional.js";
import { crossRefs as civilCrossRefs, module as civil } from "./civil.js";
import { crossRefs as commercialCrossRefs, module as commercial } from "./commercial-corporate.js";
import { crossRefs as constitutionalCrossRefs, module as constitutional } from "./constitutional.js";
import { crossRefs as criminalCrossRefs, module as criminal } from "./criminal.js";
import { crossRefs as familyCrossRefs, module as family } from "./family.js";
import { crossRefs as hrCrossRefs, module as hr } from "./human-resources.js";
import { crossRefs as laborCrossRefs, module as labor } from "./labor.js";
import { crossRefs as localGovCrossRefs, module as localGov } from "./local-government.js";
import { crossRefs as payrollCrossRefs, module as payroll } from "./payroll.js";
import { crossRefs as remedialCrossRefs, module as remedial } from "./remedial.js";
import { crossRefs as specialCrossRefs, module as special } from "./special.js";
import { crossRefs as taxCrossRefs, module as tax } from "./tax.js";
import type { CrossReference, DomainModule, DomainModuleWithRefs } from "./types.js";

export const DOMAIN_MODULES: DomainModule[] = [
  constitutional,
  civil,
  family,
  criminal,
  tax,
  labor,
  commercial,
  business,
  accounting,
  payroll,
  hr,
  remedial,
  administrative,
  localGov,
  special,
];

/** Map slug → cross-references (order mirrors DOMAIN_MODULES). */
const CROSS_REFS: Record<string, CrossReference[]> = {
  constitutional: constitutionalCrossRefs,
  civil: civilCrossRefs,
  family: familyCrossRefs,
  criminal: criminalCrossRefs,
  tax: taxCrossRefs,
  labor: laborCrossRefs,
  "commercial-corporate": commercialCrossRefs,
  "business-transactional": businessCrossRefs,
  accounting: accountingCrossRefs,
  payroll: payrollCrossRefs,
  "human-resources": hrCrossRefs,
  remedial: remedialCrossRefs,
  administrative: administrativeCrossRefs,
  "local-government": localGovCrossRefs,
  special: specialCrossRefs,
};

const BY_SLUG: Map<string, DomainModule> = new Map(DOMAIN_MODULES.map((m) => [m.slug, m]));

/** Look up a domain module by slug. */
export function getDomain(slug: string): DomainModule | undefined {
  return BY_SLUG.get(slug);
}

/** All domain modules with their cross-references. */
export function allDomainModules(): DomainModuleWithRefs[] {
  return DOMAIN_MODULES.map((m) => ({
    module: m,
    crossRefs: CROSS_REFS[m.slug] ?? [],
  }));
}

/** Validate the registry invariants (used by tests + list_domains sanity). */
export function validateRegistry(): string[] {
  const problems: string[] = [];
  const slugs = new Set<string>();
  for (const m of DOMAIN_MODULES) {
    if (slugs.has(m.slug)) problems.push(`duplicate slug: ${m.slug}`);
    slugs.add(m.slug);
    for (const ref of CROSS_REFS[m.slug] ?? []) {
      if (!BY_SLUG.has(ref.target)) problems.push(`${m.slug} → unknown cross-ref target: ${ref.target}`);
    }
  }
  return problems;
}
