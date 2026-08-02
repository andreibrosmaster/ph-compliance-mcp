import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "labor",
  name: "Labor Law",
  description: "Labor Code (PD 442) and related statutes",
  keyInstruments: [
    "Labor Code of the Philippines (PD 442)",
    "RA 6715 (NLRC strengthening)",
  ],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "monthly" },
    { name: "LawPhil", url: "https://lawphil.net", cadence: "monthly" },
  ],
  corpora: ["laws", "cases"],
  refreshCadence: "medium",
};

export const crossRefs: CrossReference[] = [
  { target: "constitutional", reason: "Labor is a protected constitutional interest (Art. XIII)." },
  { target: "civil", reason: "Employment contracts and obligations doctrine." },
  { target: "remedial", reason: "NLRC rules and labor case procedure." },
];
