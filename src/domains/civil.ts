import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "civil",
  name: "Civil Law",
  description: "Civil Code (RA 386) and amendments",
  keyInstruments: ["Civil Code of the Philippines (RA 386)"],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "rarely" },
    { name: "LawPhil", url: "https://lawphil.net", cadence: "rarely" },
  ],
  corpora: ["laws"],
  refreshCadence: "low",
};

export const crossRefs: CrossReference[] = [
  { target: "constitutional", reason: "Constitutional limits on private-law provisions." },
  { target: "family", reason: "Family Code (EO 209) superseded Book I of the Civil Code on family relations." },
  { target: "commercial-corporate", reason: "Obligations and contracts underpin corporate and commercial law." },
  { target: "special", reason: "Special laws like the Data Privacy Act create civil liabilities." },
];
