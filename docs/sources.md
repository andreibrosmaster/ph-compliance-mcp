# Authoritative Philippine Legal & Compliance Sources

Research-backed list of primary sources for corpus ingestion. **Primary sources
over commentary** is a hard constraint (blueprint §2): codal text and decisions
themselves, never bar-review summaries or law-firm blog paraphrases.

## Statutes, issuances & the official record

| Source | URL | Notes |
|---|---|---|
| Official Gazette | https://www.officialgazette.gov.ph | Laws, executive issuances, proclamations, journal |
| Congress of the Philippines | https://www.congress.gov.ph | House bills/acts; legislative history |
| Senate | https://legacy.senate.gov.ph | Senate bills/resolutions |
| LawPhil (Arellano Law Foundation) | https://lawphil.net | Statutes, PDs, jurisprudence archive (cross-check source) |

## Jurisprudence

| Source | URL | Notes |
|---|---|---|
| Supreme Court E-Library | https://elibrary.judiciary.gov.ph | Decisions, resolutions, court rules (auth at Phase 4) |
| LawPhil jurisprudence | https://lawphil.net/juris/ | G.R. decisions, alternative mirror |

## National Government Agency (NGA) issuances

| Agency | URL | Cadence |
|---|---|---|
| BIR | https://www.bir.gov.ph/index.php/issuances | weekly |
| DOLE | https://www.dole.gov.ph | weekly |
| DTI | https://www.dti.gov.ph | monthly |
| CSC | https://www.csc.gov.ph | monthly |
| DBM | https://www.dbm.gov.ph | monthly |
| COA | https://www.coa.gov.ph | monthly |
| DOF | https://www.dof.gov.ph | monthly |
| DENR | https://www.denr.gov.ph | monthly |
| DOJ | https://www.doj.gov.ph | monthly |
| DICT | https://www.dict.gov.ph | monthly |
| NPC (privacy) | https://www.privacy.gov.ph | monthly |
| SEC | https://www.sec.gov.ph | monthly |

## GOCC & benefit agencies (payroll/benefits coverage)

| Agency | URL | Notes |
|---|---|---|
| SSS | https://www.sss.gov.ph | RA 11199 contributions/benefits |
| PhilHealth | https://www.philhealth.gov.ph | RA 11223 premium schedules |
| Pag-IBIG Fund | https://www.pagibigfund.gov.ph | RA 9679 contributions |
| GSIS | https://www.gsis.gov.ph | government service insurance |

## Local Government Units (LGU)

LGU issuances (ordinances, resolutions, executive orders) are sourced per-LGU
from official LGU portals; the Local Government Code (RA 7160) governs the
forms and publication requirements. LGU corpus ingestion is a documented
Phase 3+ issuance target (`domains/local-government`).

## Ingestion rules (constraint #5)

- Record URL, retrieval date, and a SHA-256 content hash for everything ingested.
- Respect robots.txt, use conditional GETs, throttle (see `data-pipeline/http-client.ts`).
- Verify checksums on corpus release assets before serving (see `corpus-loader.ts`).
