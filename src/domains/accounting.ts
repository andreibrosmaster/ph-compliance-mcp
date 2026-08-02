import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "accounting",
  name: "Accounting & Auditing Law",
  description:
    "Accountancy Act (RA 9298), PFRS/PSA standards, SEC & BOA regulations, COA audit rules",
  keyInstruments: [
    "Philippine Accountancy Act of 2004 (RA 9298)",
    "Revised Corporation Code audit provisions (RA 11232)",
    "COA rules and regulations on audit",
  ],
  sources: [
    { name: "COA", url: "https://www.coa.gov.ph", cadence: "monthly" },
    { name: "Board of Accountancy / PRC", url: "https://www.prc.gov.ph", cadence: "quarterly" },
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "monthly" },
  ],
  corpora: ["laws", "issuances"],
  refreshCadence: "medium",
};

export const crossRefs: CrossReference[] = [
  { target: "tax", reason: "Financial statements underpin tax compliance and BIR audits." },
  { target: "commercial-corporate", reason: "Audit and reporting obligations of corporations (RA 11232)." },
  { target: "administrative", reason: "COA/PRC exercise administrative and disciplinary powers." },
  { target: "payroll", reason: "Withholding and benefit contributions are accounting entries and filings." },
];
