import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "business-transactional",
  name: "Business & Transactional Law",
  description:
    "Contracts, sales, agency, credit transactions, negotiable instruments, Ease of Doing Business (RA 11032), consumer protection",
  keyInstruments: [
    "Civil Code obligations and contracts (RA 386)",
    "Negotiable Instruments Law (Act 2031)",
    "Ease of Doing Business Act (RA 11032)",
    "Consumer Act of the Philippines (RA 7394)",
  ],
  sources: [
    { name: "DTI", url: "https://www.dti.gov.ph", cadence: "monthly" },
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "monthly" },
    { name: "LawPhil", url: "https://lawphil.net", cadence: "rarely" },
  ],
  corpora: ["laws", "cases", "issuances"],
  refreshCadence: "medium",
};

export const crossRefs: CrossReference[] = [
  { target: "civil", reason: "Obligations and contracts sit in the Civil Code." },
  { target: "commercial-corporate", reason: "Corporate transactions, securities, and financing." },
  { target: "special", reason: "EODB, data privacy, and cross-cutting consumer rules." },
  { target: "remedial", reason: "Litigation of contractual and transactional disputes." },
];
