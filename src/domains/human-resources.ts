import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "human-resources",
  name: "Human Resources & Workplace Compliance",
  description:
    "DOLE issuances, labor standards, termination rules, OSH (RA 11058), service incentive leave, employment contracts",
  keyInstruments: [
    "Labor Code of the Philippines (PD 442)",
    "Occupational Safety and Health Standards Law (RA 11058)",
    "Service Incentive Leave provisions (Labor Code)",
    "DOLE Department Orders and Labor Advisories",
  ],
  sources: [
    { name: "DOLE", url: "https://www.dole.gov.ph", cadence: "weekly" },
    { name: "NLRC", url: "https://www.nlrc.gov.ph", cadence: "monthly" },
    { name: "CSC (civil service)", url: "https://www.csc.gov.ph", cadence: "monthly" },
  ],
  corpora: ["laws", "cases", "issuances"],
  refreshCadence: "high",
};

export const crossRefs: CrossReference[] = [
  { target: "labor", reason: "HR rules operationalize Labor Code standards." },
  { target: "payroll", reason: "Termination, leave, and benefit entitlements drive payroll." },
  { target: "administrative", reason: "DOLE/CSC issue and enforce implementing rules." },
  { target: "special", reason: "Employee data privacy and EODB compliance." },
];
