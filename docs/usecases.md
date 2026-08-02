# Use Cases

ph-compliance-mcp serves retrieval-grounded Philippine law and compliance
across 15 domains to any MCP-capable agent. Each use case shows the tool
pattern and a ready-to-paste prompt for your agent.

**Pattern:** search (`search_statute` / `search_jurisprudence` /
`search_issuance`) → exact text (`get_provision` / `get_case` /
`get_issuance`) → verify (`cite_validate`) → compute (`compute_*` where
applicable). Always end legal conclusions with a `cite_validate`.

---

## 1. Contract review (civil · business-transactional)

- Check obligations, rescission, and penalty clauses against Civil Code
  obligations/contracts (Arts. 1156–1304, 1165–1178).
- Verify prescriptive windows before drafting demand letters.

> "Review this penalty-clause paragraph. Under the Civil Code, can a court
> reduce an unconscionable penalty? Cite the exact article and validate."

## 2. Employment & HR compliance (labor · human-resources)

- Validate probation periods, termination just/authorized causes, service
  incentive leave, OSH requirements (RA 11058), anti-sexual-harassment duties
  (RA 11313).
- Check kasambahay (RA 10361) obligations.

> "Our handbook sets a 6-month probation then immediate termination without
> notice. Which Labor Code articles govern probation and termination, and what
> does the corpus say we're missing?"

## 3. Payroll & benefits (payroll)

- 13th month pay (PD 851) computation via `compute_13th_month`.
- SSS (RA 11199), PhilHealth (RA 11223), Pag-IBIG (RA 9679) contribution
  obligations; withholding rules from BIR issuances.

> "An employee earned ₱420,000 basic in 2026 across 12 months. Compute the
> 13th-month pay and list the exclusions we must check under PD 851."

## 4. Tax compliance (tax · accounting)

- NIRC (RA 8424) as amended by TRAIN (RA 10963) / CREATE (RA 11534):
  withholding, VAT, income tax thresholds.
- Accountancy Act (RA 9298) practice rules; COA audit rules (PD 1445) for
  government books.

> "For a purely-compensation individual earning ₱300,000 gross, is there
> withholding? Use the NIRC compensation-income rules in the corpus and
> validate."

## 5. Corporate & securities (commercial-corporate)

- Revised Corporation Code (RA 11232): one-person corporations, perpetual
  term, board duties.
- Securities Regulation Code (RA 8799); IP Code (RA 8293) filings.

> "Can a one-person corporation exist under RA 11232, and what are the
> liability rules for the sole stockholder? Cite sections and validate."

## 6. Business setup & transactions (business-transactional)

- Ease of Doing Business (RA 11032) registration timelines, zero-contact
  policy.
- Negotiable instruments (Act 2031) — checks, endorsements, presentment.

> "A customer's check bounced. Walk me through holder-in-due-course and
> dishonor rules under the Negotiable Instruments Law, citing sections."

## 7. Litigation & deadlines (remedial)

- Compute reglementary periods with `compute_deadline` (Rule 37/41/45/65 +
  Rule 22 computation of time).
- Pre-suit demands, appeals, certiorari windows; ADR Act (RA 9285).

> "Notice of the RTC decision was served 2026-08-02. Compute the last day to
> file a motion for reconsideration, treating 2026-08-30 as a holiday."

## 8. Family law (family)

- Marriage validity, property regimes, support, annulment/void marriage
  grounds under the Family Code (EO 209).

> "What are the grounds for a void marriage under the Family Code? Cite
> articles and validate."

## 9. Criminal compliance (criminal)

- RPC (Act 3815) elements of crimes; special penal laws (RA 9165 drugs,
  RA 9262 VAWC, RA 10175 cybercrime).

> "Compare the elements of theft vs robbery under the RPC, then check whether
> the corpus has the recent jurisprudence on cyber libel under RA 10175."

## 10. Government & public service (administrative · local-government)

- Administrative Code (EO 292), civil-service rules; RA 6713 conduct/SALN;
  RA 3019 anti-graft.
- Local Government Code (RA 7160) ordinance power, revenue, LGU issuances.

> "Which RA 6713 provisions require filing of SALN, and who is covered?
> Also list what LGC provisions govern LGU business-license ordinances."

## 11. Special / cross-cutting (special)

- Data Privacy Act (RA 10173) — processing, PIC/PIP roles, NPC rules.
- Government Procurement Reform (RA 9184) competitive bidding.
- AMLA (RA 9160) STR/CTR duties for covered institutions; Cooperative Code
  (RA 9520); GOCC Governance Act (RA 10149).

> "Draft a data-privacy consent clause for an HR portal using the DPA's
> processing requirements, citing the sections."

## 12. Procurement (special · administrative)

> "What are the stages of competitive bidding under RA 9184 and the
> timeline for post-qualification? Cite the implementing rules in the corpus."

## 13. Prescription & claims (civil · criminal)

- `compute_prescription` for written/oral contracts, quasi-delict, forcible
  entry, defamation; criminal prescription under Act 3815.

> "A supplier claims on a written contract signed 2014-03-15. Compute the
> prescriptive deadline under the Civil Code and note the interruption rule."

## 14. Issuance research (NGA · LGU · GOCC)

- BIR revenue regulations / RMCs; SEC memorandums; DOLE department orders;
  LGU ordinances; GOCC circulars via `search_issuance` / `get_issuance`.

> "Find the latest BIR RMC on e-invoicing and summarize the transition
> deadlines, citing the reference number."

## 15. Audit & accounting (accounting)

> "Which COA rules under PD 1445 govern audit of GOCC funds, and what does
> the Accountancy Act require for CPA practice standards? Cite and validate."

---

## Using these prompts

- Replace domain-specific numbers/dates with your real facts; the tools accept
  pagination (`limit`/`offset`) and filters (`domain`, `agency`, `court`).
- If a tool returns `insufficient_corpus_coverage`, the corpus lacks a
  confident match — refine the query, or treat it as a coverage gap (do not
  let the agent guess; that is the point).
- For anything that will be relied upon (contracts, filings, litigation),
  finish with `cite_validate` and review via the returned `sourceUrl`.
