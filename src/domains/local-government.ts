import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "local-government",
  name: "Local Government Law",
  description: "Local Government Code (RA 7160)",
  keyInstruments: ["Local Government Code of 1991 (RA 7160)"],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "rarely" },
    { name: "LawPhil", url: "https://lawphil.net", cadence: "rarely" },
  ],
  corpora: ["laws"],
  refreshCadence: "low",
};

export const crossRefs: CrossReference[] = [
  { target: "constitutional", reason: "Local autonomy is a constitutional principle (Art. X)." },
  { target: "tax", reason: "Local taxation powers and the NIRC boundary." },
  { target: "administrative", reason: "Deconcentration and administrative supervision of LGUs." },
];
