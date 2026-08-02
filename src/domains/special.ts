import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "special",
  name: "Special/Cross-Cutting Laws",
  description: "Data Privacy Act (RA 10173), Ease of Doing Business Act (RA 11032), etc.",
  keyInstruments: [
    "Data Privacy Act of 2012 (RA 10173)",
    "Ease of Doing Business Act (RA 11032)",
    "Anti-Red Tape Act (RA 9485)",
  ],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "monthly" },
    { name: "NPC issuances", url: "https://www.privacy.gov.ph", cadence: "monthly" },
  ],
  corpora: ["laws", "issuances"],
  refreshCadence: "medium",
};

export const crossRefs: CrossReference[] = [
  { target: "commercial-corporate", reason: "Data privacy and EODB compliance for corporations." },
  { target: "labor", reason: "Employee data privacy and workplace rules." },
  { target: "criminal", reason: "Unauthorized access/processing carries penal sanctions (RA 10173)." },
  { target: "administrative", reason: "Regulatory agencies (NPC, ARTA) exercise administrative powers." },
];
