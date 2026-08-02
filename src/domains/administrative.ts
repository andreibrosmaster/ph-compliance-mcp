import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "administrative",
  name: "Administrative Law",
  description: "Administrative Code of 1987 (EO 292) and civil-service rules",
  keyInstruments: [
    "Administrative Code of 1987 (EO 292)",
    "Civil Service Commission rules",
  ],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "quarterly" },
    { name: "CSC issuances", url: "https://www.csc.gov.ph", cadence: "quarterly" },
  ],
  corpora: ["laws", "issuances"],
  refreshCadence: "medium",
};

export const crossRefs: CrossReference[] = [
  { target: "constitutional", reason: "Due process in administrative proceedings; separation of powers." },
  { target: "remedial", reason: "Judicial review of administrative decisions." },
  { target: "tax", reason: "BIR rule-making is an administrative-law function." },
];
