import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "tax",
  name: "Tax Law",
  description: "National Internal Revenue Code (RA 8424, as amended) and BIR issuances",
  keyInstruments: [
    "National Internal Revenue Code (RA 8424, as amended — TRAIN, CREATE)",
    "Local Government Code (RA 7160) local tax provisions",
  ],
  sources: [
    { name: "BIR issuance archive", url: "https://www.bir.gov.ph/index.php/issuances", cadence: "weekly" },
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "monthly" },
  ],
  corpora: ["laws", "issuances"],
  refreshCadence: "high",
};

export const crossRefs: CrossReference[] = [
  { target: "constitutional", reason: "Taxation must be for public purpose and uniform; due process limits." },
  { target: "commercial-corporate", reason: "Corporate income tax, withholding, and corporate law interplay." },
  { target: "local-government", reason: "Local tax powers under RA 7160 and the NIRC boundary." },
  { target: "special", reason: "Special laws (e.g. CREATE) amend NIRC provisions." },
];
