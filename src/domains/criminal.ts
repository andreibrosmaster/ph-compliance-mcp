import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "criminal",
  name: "Criminal Law",
  description: "Revised Penal Code (Act 3815) and special penal laws",
  keyInstruments: [
    "Revised Penal Code (Act 3815)",
    "RA 9165 (Comprehensive Dangerous Drugs Act)",
    "RA 10951 (penalty adjustments)",
  ],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "monthly" },
    { name: "LawPhil", url: "https://lawphil.net", cadence: "monthly" },
  ],
  corpora: ["laws"],
  refreshCadence: "medium",
};

export const crossRefs: CrossReference[] = [
  { target: "constitutional", reason: "Bill of Rights constrains penal statutes (ex post facto, double jeopardy)." },
  { target: "remedial", reason: "Criminal procedure and rules on evidence." },
  { target: "special", reason: "Special penal laws (cybercrime, trafficking) overlap with cross-cutting statutes." },
];
