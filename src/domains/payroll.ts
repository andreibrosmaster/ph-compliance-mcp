import type { CrossReference, DomainModule } from "./types.js";

export const module: DomainModule = {
  slug: "payroll",
  name: "Payroll & Benefits Law",
  description:
    "13th month pay (PD 851), SSS (RA 11199), PhilHealth (RA 11223), Pag-IBIG (RA 9679), withholding on compensation",
  keyInstruments: [
    "13th Month Pay Law (PD 851)",
    "Social Security Act of 2018 (RA 11199)",
    "Universal Health Care Act PhilHealth provisions (RA 11223)",
    "Home Development Mutual Fund Law (RA 9679)",
  ],
  sources: [
    { name: "SSS", url: "https://www.sss.gov.ph", cadence: "monthly" },
    { name: "PhilHealth", url: "https://www.philhealth.gov.ph", cadence: "monthly" },
    { name: "Pag-IBIG Fund", url: "https://www.pagibigfund.gov.ph", cadence: "monthly" },
    { name: "BIR (withholding)", url: "https://www.bir.gov.ph/index.php/issuances", cadence: "weekly" },
  ],
  corpora: ["laws", "issuances"],
  refreshCadence: "high",
};

export const crossRefs: CrossReference[] = [
  { target: "labor", reason: "Wage and benefit minima under the Labor Code interplay with payroll." },
  { target: "tax", reason: "Withholding tax on compensation is a BIR obligation." },
  { target: "accounting", reason: "Payroll entries and contribution remittances are audited." },
  { target: "special", reason: "Data privacy applies to employee payroll and benefit records." },
];
