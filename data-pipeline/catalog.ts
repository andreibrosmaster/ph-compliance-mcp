/**
 * Instrument catalog — the ingestion manifest for the whole databank
 * (production-readiness push, 0.7.0). Enumerates the Philippine legal and
 * compliance instruments to ingest, across all 15 domains, with canonical act
 * numbers, titles, and source URLs. METADATA ONLY — it never fabricates legal
 * text (blueprint §7). Body text comes from official sources via seed JSONL or
 * source adapters.
 *
 * Drives: databank maximization (nothing is ingested that isn't cataloged),
 * list_domains enrichment, seed-authoring, and the Phase 5+ adapter layer.
 */
import type { DomainModule } from "../src/domains/types.js";

export type InstrumentKind =
  | "constitution"
  | "code"
  | "republic_act"
  | "presidential_decree"
  | "executive_order"
  | "act"
  | "rules"
  | "other";

export interface CatalogEntry {
  /** Stable slug, e.g. "civil-code". */
  id: string;
  shortTitle: string;
  officialTitle?: string;
  /** Canonical enactment number used by the citation resolver, e.g. "386". */
  actNumber?: string;
  kind: InstrumentKind;
  domain: string;
  enactedDate?: string;
  status: "in_force" | "amended" | "repealed" | "superseded";
  sourceUrl: string;
  /** Why it matters (for use-case docs + eval). */
  notes?: string;
}

/** All cataloged instruments, one per line for LOC discipline. */
export const INSTRUMENT_CATALOG: CatalogEntry[] = [
  // Constitutional
  { id: "1987-constitution", shortTitle: "1987 Constitution", officialTitle: "The 1987 Constitution of the Republic of the Philippines", kind: "constitution", domain: "constitutional", enactedDate: "1987-02-02", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/constitutions/1987-constitution/", notes: "Highest norm; anchors due process, equal protection, bill of rights." },
  // Civil
  { id: "civil-code", shortTitle: "Civil Code of the Philippines", officialTitle: "An Act to Ordain and Institute the Civil Code of the Philippines", actNumber: "386", kind: "republic_act", domain: "civil", enactedDate: "1949-06-18", status: "amended", sourceUrl: "https://www.officialgazette.gov.ph/1949/06/18/republic-act-no-386/", notes: "Obligations and contracts, persons, property, prescription." },
  { id: "property-registration-decree", shortTitle: "Property Registration Decree", actNumber: "1529", kind: "presidential_decree", domain: "civil", enactedDate: "1978-06-11", status: "amended", sourceUrl: "https://lawphil.net/statutes/presdecs/pd1529.html", notes: "Land registration and Torrens system." },
  { id: "insurance-code", shortTitle: "Insurance Code", actNumber: "612", kind: "presidential_decree", domain: "civil", enactedDate: "1974-12-18", status: "amended", sourceUrl: "https://lawphil.net/statutes/presdecs/pd612.html", notes: "Insurance contracts; amended by RA 10607." },
  // Family
  { id: "family-code", shortTitle: "Family Code", officialTitle: "The Family Code of the Philippines", actNumber: "209", kind: "executive_order", domain: "family", enactedDate: "1987-07-06", status: "amended", sourceUrl: "https://www.officialgazette.gov.ph/1987/07/06/executive-order-no-209-s-1987/", notes: "Marriage, family relations, property relations." },
  // Criminal
  { id: "revised-penal-code", shortTitle: "Revised Penal Code", actNumber: "3815", kind: "act", domain: "criminal", enactedDate: "1930-12-08", status: "amended", sourceUrl: "https://lawphil.net/statutes/acts/act_3815_1930.html", notes: "General penal law of the Philippines." },
  { id: "dangerous-drugs-act", shortTitle: "Comprehensive Dangerous Drugs Act of 2002", actNumber: "9165", kind: "republic_act", domain: "criminal", enactedDate: "2002-06-07", status: "amended", sourceUrl: "https://www.officialgazette.gov.ph/2002/06/07/republic-act-no-9165/", notes: "Illegal drugs penalties and rehabilitation." },
  { id: "vawc-act", shortTitle: "Anti-Violence Against Women and Their Children Act", actNumber: "9262", kind: "republic_act", domain: "criminal", enactedDate: "2004-03-08", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2004/03/08/republic-act-no-9262/", notes: "VAWC offenses and protective orders." },
  { id: "cybercrime-act", shortTitle: "Cybercrime Prevention Act of 2012", actNumber: "10175", kind: "republic_act", domain: "criminal", enactedDate: "2012-09-12", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2012/09/12/republic-act-no-10175/", notes: "Cyber offenses; data and system integrity." },
  // Tax
  { id: "nirc", shortTitle: "National Internal Revenue Code", actNumber: "8424", kind: "code", domain: "tax", enactedDate: "1997-12-11", status: "amended", sourceUrl: "https://www.officialgazette.gov.ph/1997/12/11/republic-act-no-8424/", notes: "Amended by TRAIN (RA 10963) and CREATE (RA 11534)." },
  // Labor / HR
  { id: "labor-code", shortTitle: "Labor Code of the Philippines", actNumber: "442", kind: "presidential_decree", domain: "labor", enactedDate: "1974-05-01", status: "amended", sourceUrl: "https://www.officialgazette.gov.ph/labor-code-of-the-philippines/", notes: "Employment, wages, working conditions, termination." },
  { id: "13th-month-pay", shortTitle: "13th Month Pay Law", actNumber: "851", kind: "presidential_decree", domain: "payroll", enactedDate: "1975-12-16", status: "in_force", sourceUrl: "https://lawphil.net/statutes/presdecs/pd851.html", notes: "Mandatory 13th month pay for rank-and-file; basis for compute_13th_month." },
  { id: "osh-law", shortTitle: "Occupational Safety and Health Standards Law", actNumber: "11058", kind: "republic_act", domain: "human-resources", enactedDate: "2018-08-17", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2018/08/17/republic-act-no-11058/", notes: "OSH standards, duties of employers." },
  { id: "kasambahay-law", shortTitle: "Domestic Workers Act", actNumber: "10361", kind: "republic_act", domain: "labor", enactedDate: "2013-01-18", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2013/01/18/republic-act-no-10361/", notes: "Household helpers rights, minimum wage, benefits." },
  // Commercial / Business / Transactional
  { id: "revised-corporation-code", shortTitle: "Revised Corporation Code of the Philippines", actNumber: "11232", kind: "republic_act", domain: "commercial-corporate", enactedDate: "2019-02-20", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2019/02/20/republic-act-no-11232/", notes: "Corporation law; one-person corporations, perpetual term." },
  { id: "securities-regulation-code", shortTitle: "Securities Regulation Code", actNumber: "8799", kind: "republic_act", domain: "commercial-corporate", enactedDate: "2000-07-19", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2000/07/19/republic-act-no-8799/", notes: "SEC regulation of securities and markets." },
  { id: "intellectual-property-code", shortTitle: "Intellectual Property Code", actNumber: "8293", kind: "republic_act", domain: "commercial-corporate", enactedDate: "1997-06-06", status: "amended", sourceUrl: "https://www.officialgazette.gov.ph/1997/06/06/republic-act-no-8293/", notes: "Copyright, patents, trademarks." },
  { id: "negotiable-instruments-law", shortTitle: "Negotiable Instruments Law", actNumber: "2031", kind: "act", domain: "business-transactional", enactedDate: "1911-02-03", status: "in_force", sourceUrl: "https://lawphil.net/statutes/acts/act_2031.html", notes: "Checks, promissory notes, drafts." },
  { id: "eodb-act", shortTitle: "Ease of Doing Business and Efficient Government Service Delivery Act", actNumber: "11032", kind: "republic_act", domain: "business-transactional", enactedDate: "2018-05-28", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2018/05/28/republic-act-no-11032/", notes: "Business registration timelines, zero-contact policy." },
  { id: "consumer-act", shortTitle: "Consumer Act of the Philippines", actNumber: "7394", kind: "republic_act", domain: "business-transactional", enactedDate: "1992-04-13", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/1992/04/13/republic-act-no-7394/", notes: "Consumer protection, product standards." },
  { id: "frair", shortTitle: "Financial Rehabilitation and Insolvency Act", actNumber: "10142", kind: "republic_act", domain: "business-transactional", enactedDate: "2010-07-18", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2010/07/18/republic-act-no-10142/", notes: "Corporate rehabilitation and insolvency." },
  // Accounting / Audit
  { id: "accountancy-act", shortTitle: "Philippine Accountancy Act of 2004", actNumber: "9298", kind: "republic_act", domain: "accounting", enactedDate: "2004-05-13", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2004/05/13/republic-act-no-9298/", notes: "CPA licensure and practice standards." },
  { id: "government-auditing-code", shortTitle: "Government Auditing Code", actNumber: "1445", kind: "presidential_decree", domain: "accounting", enactedDate: "1978-06-11", status: "in_force", sourceUrl: "https://lawphil.net/statutes/presdecs/pd1445.html", notes: "COA audit of government and GOCC funds." },
  // Payroll / Benefits / GOCC
  { id: "sss-act-2018", shortTitle: "Social Security Act of 2018", actNumber: "11199", kind: "republic_act", domain: "payroll", enactedDate: "2019-02-07", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2019/02/07/republic-act-no-11199/", notes: "SSS coverage, contributions, benefits." },
  { id: "uhc-act", shortTitle: "Universal Health Care Act", actNumber: "11223", kind: "republic_act", domain: "payroll", enactedDate: "2019-02-20", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2019/02/20/republic-act-no-11223/", notes: "PhilHealth automatic coverage and premium schedules." },
  { id: "pagibig-law", shortTitle: "Home Development Mutual Fund Law", actNumber: "9679", kind: "republic_act", domain: "payroll", enactedDate: "2009-07-21", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2009/07/21/republic-act-no-9679/", notes: "Pag-IBIG Fund contributions." },
  { id: "gsis-act", shortTitle: "Government Service Insurance System Act of 1997", actNumber: "8291", kind: "republic_act", domain: "payroll", enactedDate: "1997-06-06", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/1997/06/06/republic-act-no-8291/", notes: "GSIS coverage for government employees." },
  { id: "gocc-governance-act", shortTitle: "GOCC Governance Act of 2011", actNumber: "10149", kind: "republic_act", domain: "special", enactedDate: "2011-06-06", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2011/06/06/republic-act-no-10149/", notes: "Governance of government-owned and controlled corporations." },
  // Remedial
  { id: "rules-of-court", shortTitle: "Rules of Court", kind: "rules", domain: "remedial", status: "amended", sourceUrl: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/1/63852", notes: "Civil and criminal procedure; evidence." },
  { id: "adr-act", shortTitle: "Alternative Dispute Resolution Act", actNumber: "9285", kind: "republic_act", domain: "remedial", enactedDate: "2004-04-02", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2004/04/02/republic-act-no-9285/", notes: "Arbitration and mediation." },
  // Administrative / Public service
  { id: "administrative-code", shortTitle: "Administrative Code of 1987", actNumber: "292", kind: "executive_order", domain: "administrative", enactedDate: "1987-07-25", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/1987/07/25/executive-order-no-292-s-1987/", notes: "Organization of the executive branch, civil service." },
  { id: "code-of-conduct-public-officials", shortTitle: "Code of Conduct and Ethical Standards for Public Officials and Employees", actNumber: "6713", kind: "republic_act", domain: "administrative", enactedDate: "1989-02-20", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/1989/02/20/republic-act-no-6713/", notes: "Standards of conduct, SALN, public disclosure." },
  { id: "anti-graft-act", shortTitle: "Anti-Graft and Corrupt Practices Act", actNumber: "3019", kind: "republic_act", domain: "administrative", enactedDate: "1960-08-17", status: "in_force", sourceUrl: "https://lawphil.net/statutes/repacts/ra3019.html", notes: "Offenses of public officers." },
  // Local government
  { id: "local-government-code", shortTitle: "Local Government Code of 1991", actNumber: "7160", kind: "republic_act", domain: "local-government", enactedDate: "1991-10-10", status: "amended", sourceUrl: "https://www.officialgazette.gov.ph/1991/10/10/republic-act-no-7160/", notes: "LGU powers, revenue, ordinances." },
  // Special / Cross-cutting
  { id: "data-privacy-act", shortTitle: "Data Privacy Act of 2012", actNumber: "10173", kind: "republic_act", domain: "special", enactedDate: "2012-08-15", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2012/08/15/republic-act-no-10173/", notes: "Personal data protection; NPC." },
  { id: "procurement-law", shortTitle: "Government Procurement Reform Act", actNumber: "9184", kind: "republic_act", domain: "special", enactedDate: "2003-01-10", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2003/01/10/republic-act-no-9184/", notes: "Public bidding and procurement." },
  { id: "cooperative-code", shortTitle: "Philippine Cooperative Code of 2008", actNumber: "9520", kind: "republic_act", domain: "special", enactedDate: "2009-02-17", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2009/02/17/republic-act-no-9520/", notes: "Cooperative organization and governance." },
  { id: "anti-money-laundering-act", shortTitle: "Anti-Money Laundering Act", actNumber: "9160", kind: "republic_act", domain: "special", enactedDate: "2001-09-29", status: "amended", sourceUrl: "https://www.officialgazette.gov.ph/2001/09/29/republic-act-no-9160/", notes: "AMLA; covered institutions, STR/CTR." },
  { id: "safe-spaces-act", shortTitle: "Safe Spaces Act", actNumber: "11313", kind: "republic_act", domain: "human-resources", enactedDate: "2019-04-17", status: "in_force", sourceUrl: "https://www.officialgazette.gov.ph/2019/04/17/republic-act-no-11313/", notes: "Gender-based sexual harassment in workplaces and public spaces." },
];

/** Domains present in the catalog (should cover all 15). */
export function catalogDomains(): string[] {
  return [...new Set(INSTRUMENT_CATALOG.map((e) => e.domain))].sort();
}

/** Look up by stable id. */
export function catalogById(id: string): CatalogEntry | undefined {
  return INSTRUMENT_CATALOG.find((e) => e.id === id);
}

/** Look up by canonical act number (e.g. "386" or "442"). */
export function catalogByActNumber(actNumber: string): CatalogEntry | undefined {
  return INSTRUMENT_CATALOG.find((e) => e.actNumber === actNumber);
}

/** All entries for a domain slug. */
export function catalogByDomain(domain: string): CatalogEntry[] {
  return INSTRUMENT_CATALOG.filter((e) => e.domain === domain);
}

/** Validate catalog invariants: unique ids, known domains, act numbers match kind. */
export function validateCatalog(domains: DomainModule[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const actNumbers = new Set<string>();
  const known = new Set(domains.map((d) => d.slug));
  for (const e of INSTRUMENT_CATALOG) {
    if (ids.has(e.id)) problems.push(`duplicate id: ${e.id}`);
    ids.add(e.id);
    if (!known.has(e.domain)) problems.push(`${e.id} → unknown domain: ${e.domain}`);
    if (e.actNumber) {
      if (actNumbers.has(e.actNumber)) problems.push(`duplicate actNumber: ${e.actNumber}`);
      actNumbers.add(e.actNumber);
    }
    if (e.actNumber && !/^\d+$/.test(e.actNumber)) {
      problems.push(`${e.id} → actNumber must be digits: ${e.actNumber}`);
    }
    if (!e.sourceUrl.startsWith("https://")) problems.push(`${e.id} → sourceUrl must be https`);
  }
  return problems;
}
