import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "family",
  name: "Family Code",
  description: "Family Code (EO 209, as amended)",
  keyInstruments: ["Family Code of the Philippines (EO 209)"],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "rarely" },
    { name: "LawPhil", url: "https://lawphil.net", cadence: "rarely" },
  ],
  corpora: ["laws"],
  refreshCadence: "low",
};

export const crossRefs: CrossReference[] = [
  { target: "civil", reason: "Family Code superseded Civil Code Book I on persons and family relations." },
  { target: "criminal", reason: "Crimes against persons/family (e.g. concubinage, bigamy) reference family status." },
  { target: "remedial", reason: "Family courts and rules on annulment/declaration of nullity." },
];
