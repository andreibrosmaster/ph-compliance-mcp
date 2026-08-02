import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "constitutional",
  name: "Constitutional Law",
  description: "1987 Constitution; highest-norm anchor, cited cross-domain",
  keyInstruments: ["1987 Constitution of the Republic of the Philippines"],
  sources: [
    { name: "Official Gazette", url: "https://www.officialgazette.gov.ph/constitutions/1987-constitution/", cadence: "rarely" },
  ],
  corpora: ["laws"],
  refreshCadence: "low",
};

export const crossRefs: CrossReference[] = [
  { target: "civil", reason: "Constitutional limits bind private-law provisions (e.g. due process in civil procedure)." },
  { target: "criminal", reason: "Bill of Rights constrains penal statutes and criminal procedure." },
  { target: "remedial", reason: "Due process and equal protection anchor rules of court." },
  { target: "local-government", reason: "Local autonomy is a constitutional principle (Art. X)." },
];
