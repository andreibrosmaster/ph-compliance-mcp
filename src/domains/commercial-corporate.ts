import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "commercial-corporate",
  name: "Commercial/Corporate Law",
  description: "Revised Corporation Code (RA 11232), Securities Regulation Code, etc.",
  keyInstruments: [
    "Revised Corporation Code (RA 11232)",
    "Securities Regulation Code (RA 8799)",
    "Insolvency law (RA 10142)",
  ],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "monthly" },
    { name: "LawPhil", url: "https://lawphil.net", cadence: "monthly" },
  ],
  corpora: ["laws"],
  refreshCadence: "medium",
};

export const crossRefs: CrossReference[] = [
  { target: "civil", reason: "Contracts, obligations, and agency underpin corporate transactions." },
  { target: "tax", reason: "Corporate income tax and withholding obligations." },
  { target: "special", reason: "Data privacy and EODB compliance for corporations." },
];
