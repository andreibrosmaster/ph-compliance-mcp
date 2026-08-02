# Domain: Tax Law

| | |
|---|---|
| Slug | `tax` |
| Status | Phase 3 — module registered (`src/domains/tax.ts`) |
| Key instruments | National Internal Revenue Code (RA 8424, as amended — TRAIN, CREATE) |
| Primary sources | Official Gazette, LawPhil, **BIR issuance archive** |
| Refresh cadence | **high** — BIR issuances refresh weekly (ADR-003; §15) |
| Owner | BIR issuance pipeline owner (Phase 3) |
| Dependencies | `issuances.sqlite` population (BIR first) |

Purpose: the primary consumer of `issuances.sqlite`. BIR Revenue Regulations
and Revenue Memorandum Circulars populate the issuance corpus first (Phase 3),
feeding `search_issuance` / `get_issuance`. The NIRC amendments are numerous;
version correctness ("as of" queries) is a Phase 5 eval focus here.
