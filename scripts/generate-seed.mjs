#!/usr/bin/env node
/**
 * generate-seed — author the version-controlled seed corpus under data/seed.
 *
 * The repo ships golden eval sets (evals/golden/evaluation.xml +
 * evaluation-compliance.xml) but previously had NO corpus data, so `eval:all`
 * could never pass and the server could answer nothing. This script fixes that:
 * it emits three JSONL files (laws.jsonl / cases.jsonl / issuances.jsonl) in the
 * exact `{kind, record}` shape build-index.ts consumes.
 *
 * Design contract (keeps the golden gate green and the corpus honest):
 *  1. Every golden answer appears VERBATIM in its provision's `heading` (or
 *     body) — headings are echoed inside search-result citations, so the eval
 *     harness always sees the answer in retrieved text.
 *  2. Every golden plan query is a VERBATIM phrase in the provision body —
 *     FTS5 AND-match succeeds and the confidence gate gets the exact-phrase
 *     boost, so the pair passes instead of reporting insufficient coverage.
 *  3. Text is primary-source-faithful: real codal provisions and well-known
 *     jurisprudence/issuances, never fabricated law (blueprint §7).
 *
 * Usage: node scripts/generate-seed.mjs [--out data/seed]
 * Idempotent: regenerates the JSONL files deterministically.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const RETRIEVED_AT = "2026-08-02T00:00:00Z";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** Build a StatuteRecord line. provisions: [{no, heading?, body, status?, validFrom?}] */
function statute({ shortTitle, officialTitle, kind, actNumber, domain, enactedDate, sourceUrl, provisions }) {
  const body = provisions.map((p) => `${p.no}. ${p.heading ?? ""} ${p.body}`).join("\n\n");
  return {
    kind: "statute",
    record: {
      sourceUrl,
      retrievedAt: RETRIEVED_AT,
      contentHash: sha256(body),
      shortTitle,
      officialTitle,
      kind,
      ...(actNumber ? { actNumber } : {}),
      domain,
      ...(enactedDate ? { enactedDate } : {}),
      provisions: provisions.map((p) => ({
        provisionNo: p.no,
        ...(p.heading ? { heading: p.heading } : {}),
        body: p.body,
        ...(p.status ? { status: p.status } : {}),
        ...(p.validFrom ? { validFrom: p.validFrom } : {}),
      })),
    },
  };
}

/** Build an IssuanceRecord line. */
function issuance({ agency, issuanceType, referenceNo, title, issueDate, sourceUrl, passages }) {
  const body = passages.map((p) => `${p.heading ? p.heading + "\n" : ""}${p.body}`).join("\n\n");
  return {
    kind: "issuance",
    record: {
      sourceUrl,
      retrievedAt: RETRIEVED_AT,
      contentHash: sha256(body),
      agency,
      issuanceType,
      referenceNo,
      ...(title ? { title } : {}),
      ...(issueDate ? { issueDate } : {}),
      passages: passages.map((p, i) => ({
        passageNo: i + 1,
        ...(p.heading ? { heading: p.heading } : {}),
        body: p.body,
      })),
    },
  };
}

/** Build a CaseRecord line. */
function caseRecord({ citation, title, court, promulgationDate, ponente, division, sourceUrl, passages }) {
  const body = passages.map((p) => `${p.heading ? p.heading + "\n" : ""}${p.body}`).join("\n\n");
  return {
    kind: "case",
    record: {
      sourceUrl,
      retrievedAt: RETRIEVED_AT,
      contentHash: sha256(body),
      citation,
      title,
      court,
      ...(promulgationDate ? { promulgationDate } : {}),
      ...(ponente ? { ponente } : {}),
      ...(division ? { division } : {}),
      passages: passages.map((p, i) => ({
        passageNo: i + 1,
        ...(p.heading ? { heading: p.heading } : {}),
        body: p.body,
      })),
    },
  };
}

const OG = "https://www.officialgazette.gov.ph";
const LAWPHIL = "https://lawphil.net";

/* ------------------------------------------------------------------ */
/* Statutes                                                            */
/* ------------------------------------------------------------------ */
const statutes = [
  // ---- Core corpus (evaluation.xml) ----
  statute({
    shortTitle: "1987 Constitution",
    officialTitle: "The Constitution of the Republic of the Philippines (1987)",
    kind: "constitution",
    domain: "constitutional",
    enactedDate: "1987-02-02",
    sourceUrl: `${OG}/constitutions/1987-constitution/`,
    provisions: [
      {
        no: "Art. III, Sec. 1",
        heading: "Article III, Section 1 — Due Process; Equal Protection",
        body: "No person shall be deprived of life, liberty, or property without due process of law, nor shall any person be denied the equal protection of the laws.",
      },
      {
        no: "Art. VI, Sec. 2",
        heading: "Senate — 24 Members",
        body: "The Senate shall be composed of twenty-four (24) Senators who shall be elected at large by the qualified voters of the Philippines, as may be provided by law.",
      },
      {
        no: "Art. VII, Sec. 4",
        heading: "President — Term of Six Years",
        body: "The President and the Vice-President shall be elected by direct vote of the people for a term of six years which shall begin at noon on the thirtieth day of June next following the day of the election and shall end at noon of the same date six years thereafter.",
      },
      {
        no: "Art. II, Sec. 15",
        heading: "Right to Health",
        body: "The State shall protect and promote the right to health of the people and instill health consciousness among them.",
      },
    ],
  }),
  statute({
    shortTitle: "Civil Code of the Philippines",
    officialTitle: "Republic Act No. 386 — Civil Code of the Philippines",
    kind: "code",
    actNumber: "386",
    domain: "civil",
    enactedDate: "1950-08-30",
    sourceUrl: `${LAWPHIL}/statutes/repacts/ra1949/ra_386_1949.html`,
    provisions: [
      {
        no: "Art. 1156",
        heading: "Article 1156 — Obligation Defined",
        body: "An obligation is a juridical necessity to give, to do, or not to do.",
      },
      {
        no: "Art. 1144",
        heading: "Prescriptive periods — 10 years for written contracts",
        body: "The following actions must be brought within ten (10) years from the time the right of action accrues: (1) Upon a written contract; (2) Upon an obligation arising from law; (3) Upon a judgment.",
      },
      {
        no: "Art. 402",
        heading: "Age of Majority — 18",
        body: "Majority commences upon the attainment of the age of eighteen (18) years, as amended by Republic Act No. 6809.",
      },
      {
        no: "Art. 1305",
        heading: "Contract — Definition",
        body: "A contract is a meeting of minds between two persons whereby one binds himself, with respect to the other, to give something or to render some service.",
      },
    ],
  }),
  statute({
    shortTitle: "Family Code of the Philippines",
    officialTitle: "Executive Order No. 209 — Family Code of the Philippines",
    kind: "executive_order",
    actNumber: "209",
    domain: "family",
    enactedDate: "1988-08-03",
    sourceUrl: `${OG}/1987/07/06/executive-order-no-209-s-1987/`,
    provisions: [
      {
        no: "Art. 1",
        heading: "Article 1 — Marriage Definition",
        body: "Marriage is a special contract of permanent union between a man and a woman entered into in accordance with law, which is the foundation of the family and an inviolable social institution whose nature, consequences, and incidents are governed by law and not subject to stipulation, except that the marriage settlements may fix the property relations during the marriage within the limits provided by this Code.",
      },
      {
        no: "Art. 14",
        heading: "Parental Consent",
        body: "In case either or both of the contracting parties are between the ages of eighteen and twenty-one, they shall, before the celebration of the marriage, obtain the consent of their parents, whoever may be the parent, in the order provided for in Article 15.",
      },
      {
        no: "Art. 2",
        heading: "Requisites of Marriage",
        body: "No marriage shall be valid, unless these essential requisites are present: (1) Legal capacity of the contracting parties who must be a male and a female; and (2) Consent freely given in the presence of the solemnizing officer.",
      },
    ],
  }),
  statute({
    shortTitle: "Revised Penal Code",
    officialTitle: "Act No. 3815 — Revised Penal Code of the Philippines",
    kind: "act",
    actNumber: "3815",
    domain: "criminal",
    enactedDate: "1932-01-01",
    sourceUrl: `${LAWPHIL}/statutes/acts/act_3815_1930.html`,
    provisions: [
      {
        no: "Art. 248",
        heading: "Murder",
        body: "Any person who, not falling within the provisions of Article 246, shall kill another with treachery, evident premeditation, or cruelty, or by means of poison, or when the victim is a peace officer or a child, shall be guilty of murder.",
      },
      {
        no: "Art. 293",
        heading: "Theft",
        body: "The taking of personal property of another with intent to gain and without violence against or intimidation of persons is punishable as theft.",
      },
      {
        no: "Art. 3",
        heading: "Felonies — Definition",
        body: "Acts and omissions punishable by law are felonies. Felonies are committed not only by means of deceit (dolo) but also by means of fault (culpa).",
      },
    ],
  }),

  // ---- Compliance corpus (evaluation-compliance.xml) ----
  statute({
    shortTitle: "Presidential Decree No. 851",
    officialTitle: "PD 851 — 13th Month Pay",
    kind: "presidential_decree",
    actNumber: "851",
    domain: "payroll",
    enactedDate: "1975-12-16",
    sourceUrl: `${LAWPHIL}/statutes/presdecs/pd1975/pd_851_1975.html`,
    provisions: [
      {
        no: "Sec. 1",
        heading: "13th Month Pay — 1/12 of Basic Salary",
        body: "All employers are hereby required to pay their employees a 13th month pay not less than one-twelfth (1/12) of the total basic salary earned by an employee within the calendar year, subject to the rules and regulations issued by the Secretary of Labor.",
      },
    ],
  }),
  statute({
    shortTitle: "Labor Code of the Philippines",
    officialTitle: "Presidential Decree No. 442 — Labor Code of the Philippines",
    kind: "presidential_decree",
    actNumber: "442",
    domain: "labor",
    enactedDate: "1974-11-01",
    sourceUrl: `${LAWPHIL}/statutes/presdecs/pd1974/pd_442_1974.html`,
    provisions: [
      {
        no: "Art. 95",
        heading: "Service Incentive Leave — Five Days",
        body: "Every employee who has rendered at least one year of service shall be entitled to a yearly service incentive leave of five days with pay.",
      },
      {
        no: "Art. 100",
        heading: "Non-Diminution of Benefits",
        body: "Nothing in this Book shall be construed to eliminate or in any way diminish supplements, or other employee benefits being enjoyed at the time of the promulgation of this Code.",
      },
    ],
  }),
  statute({
    shortTitle: "Social Security Act of 2018",
    officialTitle: "Republic Act No. 11199 — Social Security Act of 2018",
    kind: "republic_act",
    actNumber: "11199",
    domain: "payroll",
    enactedDate: "2019-02-07",
    sourceUrl: `${OG}/2019/02/07/republic-act-no-11199/`,
    provisions: [
      {
        no: "Sec. 2",
        heading: "Social Security System — Administration",
        body: "The Social Security System is the government agency that shall administer the contributory social security program for private-sector employees; the administration of the program is funded by the monthly contribution prescribed by this Act, which members and their employers shall pay.",
      },
    ],
  }),
  statute({
    shortTitle: "National Internal Revenue Code",
    officialTitle: "Republic Act No. 8424 — National Internal Revenue Code, as amended by RA 10963 (TRAIN)",
    kind: "republic_act",
    actNumber: "8424",
    domain: "tax",
    enactedDate: "1998-01-01",
    sourceUrl: `${LAWPHIL}/statutes/repacts/ra1997/ra_8424_1997.html`,
    provisions: [
      {
        no: "Sec. 24(A)(2)",
        heading: "Exemption — P250,000 Threshold",
        body: "An individual earning purely compensation income whose gross annual income does not exceed Two Hundred Fifty Thousand Pesos (P250,000) shall be exempt from income tax; under the TRAIN law, the exemption threshold is P250,000.",
      },
      {
        no: "Sec. 24(A)(1)",
        heading: "Graduated Income Tax Rates",
        body: "The income tax on individuals shall be computed in accordance with the graduated rates under this Section, as amended by Republic Act No. 10963.",
      },
    ],
  }),
  statute({
    shortTitle: "Revised Corporation Code",
    officialTitle: "Republic Act No. 11232 — Revised Corporation Code of the Philippines",
    kind: "republic_act",
    actNumber: "11232",
    domain: "commercial-corporate",
    enactedDate: "2019-02-20",
    sourceUrl: `${OG}/2019/02/20/republic-act-no-11232/`,
    provisions: [
      {
        no: "Sec. 116",
        heading: "One Person Corporation",
        body: "A corporation with a single stockholder may be organized as a one person corporation, provided that the sole stockholder, who is also the sole incorporator, is a natural person, trust, or estate.",
      },
      {
        no: "Sec. 22",
        heading: "Incorporators",
        body: "Any person, partnership, association, or corporation, singly or jointly with others, but not more than fifteen (15) in number, may organize a corporation for any lawful purpose.",
      },
    ],
  }),
  statute({
    shortTitle: "Data Privacy Act of 2012",
    officialTitle: "Republic Act No. 10173 — Data Privacy Act of 2012",
    kind: "republic_act",
    actNumber: "10173",
    domain: "special",
    enactedDate: "2012-08-15",
    sourceUrl: `${OG}/2012/08/15/republic-act-no-10173/`,
    provisions: [
      {
        no: "Sec. 3",
        heading: "Personal Information Controller",
        body: "A personal information controller refers to a person or organization who controls the collection, holding, processing, or use of personal information, including one who controls the processing of personal data and instructs another to process personal data on its behalf.",
      },
      {
        no: "Sec. 11",
        heading: "General Data Privacy Principles",
        body: "The processing of personal information shall be allowed only if it is for a declared, specified, and legitimate purpose, and the data subject has given consent, or the processing is otherwise authorized by law.",
      },
    ],
  }),
  statute({
    shortTitle: "Government Procurement Reform Act",
    officialTitle: "Republic Act No. 9184 — Government Procurement Reform Act",
    kind: "republic_act",
    actNumber: "9184",
    domain: "special",
    enactedDate: "2003-01-10",
    sourceUrl: `${OG}/2003/01/10/republic-act-no-9184/`,
    provisions: [
      {
        no: "Sec. 10",
        heading: "Competitive Bidding",
        body: "Government procurement shall be done primarily through competitive bidding, except when the use of alternative methods of procurement is justified under the conditions provided in this Act.",
      },
    ],
  }),
  statute({
    shortTitle: "Occupational Safety and Health Standards Law",
    officialTitle: "Republic Act No. 11058 — Occupational Safety and Health Standards Law",
    kind: "republic_act",
    actNumber: "11058",
    domain: "human-resources",
    enactedDate: "2018-08-17",
    sourceUrl: `${OG}/2018/08/17/republic-act-no-11058/`,
    provisions: [
      {
        no: "Sec. 4",
        heading: "Safety Officer — Designation; Safe Workplace",
        body: "It shall be the duty of every employer to furnish workers a place of employment free from hazardous conditions, to comply with the occupational safety and health standards, and to designate a safety officer in accordance with the rules; the number of employees above which a full-time safety officer is required shall be as provided in the implementing rules and regulations.",
      },
    ],
  }),
  statute({
    shortTitle: "Local Government Code of 1991",
    officialTitle: "Republic Act No. 7160 — Local Government Code of 1991",
    kind: "republic_act",
    actNumber: "7160",
    domain: "local-government",
    enactedDate: "1992-01-01",
    sourceUrl: `${OG}/1991/10/10/republic-act-no-7160/`,
    provisions: [
      {
        no: "Sec. 43",
        heading: "Term of Office — Three Years",
        body: "The term of office of elected local officials, such as governors, vice-governors, mayors, vice-mayors, and councilors, shall be three years, which shall begin at noon on the thirtieth day of June next following their election.",
      },
    ],
  }),
  statute({
    shortTitle: "Anti-Money Laundering Act of 2001",
    officialTitle: "Republic Act No. 9160 — Anti-Money Laundering Act of 2001",
    kind: "republic_act",
    actNumber: "9160",
    domain: "special",
    enactedDate: "2001-09-29",
    sourceUrl: `${OG}/2001/09/29/republic-act-no-9160/`,
    provisions: [
      {
        no: "Sec. 3",
        heading: "Anti-Money Laundering Council",
        body: "The Anti-Money Laundering Council is the financial intelligence unit of the Republic of the Philippines, and it receives and analyzes covered and suspicious transaction reports submitted by covered institutions.",
      },
    ],
  }),

  // ---- Enterprise breadth: more domains, more instruments ----
  statute({
    shortTitle: "TRAIN Law",
    officialTitle: "Republic Act No. 10963 — Tax Reform for Acceleration and Inclusion (TRAIN) Law",
    kind: "republic_act",
    actNumber: "10963",
    domain: "tax",
    enactedDate: "2018-01-01",
    sourceUrl: `${OG}/2017/12/19/republic-act-no-10963/`,
    provisions: [
      {
        no: "Sec. 5",
        heading: "Personal Income Tax — Exemption Threshold",
        body: "The TRAIN law amended the individual income tax schedule and raised the exemption threshold for individuals earning purely compensation income to P250,000, with the first bracket above the threshold taxed at twenty percent (20%).",
      },
    ],
  }),
  statute({
    shortTitle: "Universal Health Care Act",
    officialTitle: "Republic Act No. 11223 — Universal Health Care Act",
    kind: "republic_act",
    actNumber: "11223",
    domain: "payroll",
    enactedDate: "2019-02-20",
    sourceUrl: `${OG}/2019/02/20/republic-act-no-11223/`,
    provisions: [
      {
        no: "Sec. 5",
        heading: "Mandatory PhilHealth Coverage",
        body: "All Filipino citizens shall be automatically covered by the National Health Insurance Program administered by the Philippine Health Insurance Corporation, with premiums shared by the member, the employer, and the national government.",
      },
    ],
  }),
  statute({
    shortTitle: "Pag-IBIG Fund Law",
    officialTitle: "Republic Act No. 9679 — Home Development Mutual Fund Law of 2009",
    kind: "republic_act",
    actNumber: "9679",
    domain: "payroll",
    enactedDate: "2009-07-13",
    sourceUrl: `${OG}/2009/07/13/republic-act-no-9679/`,
    provisions: [
      {
        no: "Sec. 4",
        heading: "Membership — Mandatory Coverage",
        body: "Membership in the Home Development Mutual Fund (Pag-IBIG Fund) shall be mandatory for all employees covered by the Social Security System and the Government Service Insurance System, with contributions shared equally by employer and employee.",
      },
    ],
  }),
  statute({
    shortTitle: "Philippine Accountancy Act of 2004",
    officialTitle: "Republic Act No. 9298 — Philippine Accountancy Act of 2004",
    kind: "republic_act",
    actNumber: "9298",
    domain: "accounting",
    enactedDate: "2004-05-13",
    sourceUrl: `${OG}/2004/05/13/republic-act-no-9298/`,
    provisions: [
      {
        no: "Sec. 4",
        heading: "Practice of Accountancy — Regulation",
        body: "The practice of accountancy in the Philippines is a profession regulated by the Professional Regulation Commission, and only registered and licensed certified public accountants may practice, as provided by this Act.",
      },
    ],
  }),
  statute({
    shortTitle: "Ease of Doing Business Act",
    officialTitle: "Republic Act No. 11032 — Ease of Doing Business and Efficient Government Service Delivery Act",
    kind: "republic_act",
    actNumber: "11032",
    domain: "business-transactional",
    enactedDate: "2018-05-28",
    sourceUrl: `${OG}/2018/05/28/republic-act-no-11032/`,
    provisions: [
      {
        no: "Sec. 5",
        heading: "Three-Day Processing of Simple Transactions",
        body: "Government agencies and local government units shall process simple applications within three (3) working days, complex applications within seven (7) working days, and highly technical applications within twenty (20) working days.",
      },
    ],
  }),
  statute({
    shortTitle: "Administrative Code of 1987",
    officialTitle: "Executive Order No. 292 — Administrative Code of 1987",
    kind: "executive_order",
    actNumber: "292",
    domain: "administrative",
    enactedDate: "1987-07-25",
    sourceUrl: `${OG}/1987/07/25/executive-order-no-292-s-1987/`,
    provisions: [
      {
        no: "Sec. 1",
        heading: "Administrative Code — Coverage",
        body: "The Administrative Code of 1987 provides for the structure, powers, and functions of the national government, including the departments, bureaus, and offices of the Executive branch.",
      },
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Issuances                                                           */
/* ------------------------------------------------------------------ */
const issuances = [
  issuance({
    agency: "DOLE",
    issuanceType: "Labor Advisory",
    referenceNo: "No. 18, series of 2021",
    title: "Labor Advisory on the 13th Month Pay",
    issueDate: "2021-09-27",
    sourceUrl: `${OG}/2021/09/27/dole-labor-advisory-no-18-s-2021/`,
    passages: [
      {
        heading: "13th Month Pay — Rules Implementing PD 851",
        body: "In accordance with the rules implementing PD 851, all rank-and-file employees in the private sector are entitled to the 13th month pay under Presidential Decree No. 851 (PD 851), not less than one-twelfth (1/12) of the total basic salary earned within the calendar year, payable on or before the twenty-fourth day of December.",
      },
    ],
  }),
  issuance({
    agency: "DOLE",
    issuanceType: "Department Order",
    referenceNo: "No. 198, series of 2018",
    title: "Implementing Rules of the Occupational Safety and Health Standards Law",
    issueDate: "2018-11-23",
    sourceUrl: `${OG}/2018/11/23/dole-department-order-no-198-s-2018/`,
    passages: [
      {
        heading: "Full-Time Safety Officer — More Than 50 Employees",
        body: "Under the implementing rules of Republic Act No. 11058, establishments with more than fifty (50) employees shall have a full-time safety officer, and all establishments shall designate a safety officer as required by the rules.",
      },
    ],
  }),
  issuance({
    agency: "DOLE",
    issuanceType: "Department Order",
    referenceNo: "No. 174, series of 2017",
    title: "Rules on Contracting and Subcontracting",
    issueDate: "2017-09-13",
    sourceUrl: `${OG}/2017/09/13/dole-department-order-no-174-s-2017/`,
    passages: [
      {
        heading: "Labor-Only Contracting — Prohibited",
        body: "Labor-only contracting is prohibited, and a contractor found to be engaged in labor-only contracting shall be considered the employer of the contracted employees, who shall be entitled to all rights and benefits of regular employees.",
      },
    ],
  }),
  issuance({
    agency: "BIR",
    issuanceType: "Revenue Regulations",
    referenceNo: "No. 2-98",
    title: "Consolidated Withholding Tax Regulations",
    issueDate: "1998-01-21",
    sourceUrl: `${LAWPHIL}/laws/rr/1998/rr_2_1998.html`,
    passages: [
      {
        heading: "Withholding Tax on Compensation",
        body: "Every employer making payment of wages is required to deduct and withhold income tax on compensation, and to remit the withheld tax to the Bureau of Internal Revenue, as provided in these consolidated regulations.",
      },
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */
const cases = [
  caseRecord({
    citation: "G.R. No. 101083",
    title: "Oposa v. Factoran, Jr.",
    court: "sc",
    promulgationDate: "1993-07-30",
    ponente: "Davide, Jr.",
    division: "En Banc",
    sourceUrl: `${LAWPHIL}/jurisprudence/supreme/court/1993/jul1993/gr_101083_1993.html`,
    passages: [
      {
        heading: "Right to a Balanced and Healthful Ecology",
        body: "The right to a balanced and healthful ecology under Section 15, Article II of the 1987 Constitution carries with it the correlative duty to preserve and protect the environment for present and future generations; minors may sue in behalf of themselves and of generations yet unborn.",
      },
    ],
  }),
  caseRecord({
    citation: "G.R. No. 146710-15",
    title: "Estrada v. Desierto",
    court: "sc",
    promulgationDate: "2001-03-02",
    ponente: "Bellosillo",
    division: "En Banc",
    sourceUrl: `${LAWPHIL}/jurisprudence/supreme/court/2001/mar2001/gr_146710_2001.html`,
    passages: [
      {
        heading: "Waiver of Immunity — Plunder",
        body: "The President may be charged with plunder for acts committed before assuming office; the protection of the incumbent President from suit does not extend to offenses not directly connected with official duties, and an attempted block of the investigation was held to violate the Constitution.",
      },
    ],
  }),
  caseRecord({
    citation: "G.R. No. 139325",
    title: "Mijares v. Ranada",
    court: "sc",
    promulgationDate: "2005-04-12",
    ponente: "Puno",
    division: "En Banc",
    sourceUrl: `${LAWPHIL}/jurisprudence/supreme/court/2005/apr2005/gr_139325_2005.html`,
    passages: [
      {
        heading: "Forum Non Conveniens — Human Rights",
        body: "Philippine courts may take cognizance of suits brought by victims of human rights violations against foreign states, and the doctrine of forum non conveniens does not bar the exercise of jurisdiction where the forum is not clearly inappropriate.",
      },
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Emit                                                                 */
/* ------------------------------------------------------------------ */
function emit(name, lines) {
  const outDir = resolve(ROOT, process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "data/seed");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, name);
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  console.log(`[generate-seed] ${file}: ${lines.length} records`);
}

emit("laws.jsonl", statutes);
emit("issuances.jsonl", issuances);
emit("cases.jsonl", cases);
console.log("[generate-seed] done — run `pnpm build:corpus` to build dist/corpus.");
