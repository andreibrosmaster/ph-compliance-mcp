import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "remedial",
  name: "Remedial Law",
  description: "Rules of Court and rules of procedure/evidence",
  keyInstruments: [
    "Rules of Court (as amended, incl. 2019 Amendments)",
    "Rules on Evidence",
  ],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph", cadence: "quarterly" },
    { name: "LawPhil", url: "https://lawphil.net", cadence: "quarterly" },
  ],
  corpora: ["laws", "cases"],
  refreshCadence: "medium",
};

export const crossRefs: CrossReference[] = [
  { target: "constitutional", reason: "Due process and equal protection anchor rules of court." },
  { target: "criminal", reason: "Criminal procedure and rules on evidence." },
  { target: "civil", reason: "Civil procedure applies to civil actions and appeals." },
];
