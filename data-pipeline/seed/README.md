# Seed data (ingestion input)

`build-index.ts` ingests JSONL files from this directory (any `*.jsonl`, one JSON
object per line). Each line is either a `statute`, `case`, or `issuance` record.
This is the interface between raw fetched material and the corpus build — source
adapters (or a human-curated pass) produce these files.

Every record carries **provenance** (constraint #5): `sourceUrl`, `retrievedAt`,
`contentHash` (SHA-256 of the normalized text).

## Statute line

```json
{
  "kind": "statute",
  "record": {
    "sourceUrl": "https://www.officialgazette.gov.ph/constitutions/1987-constitution/",
    "retrievedAt": "2026-08-02T00:00:00.000Z",
    "contentHash": "<sha256 of normalized text>",
    "shortTitle": "1987 Constitution",
    "officialTitle": "The 1987 Constitution of the Republic of the Philippines",
    "kind": "constitution",
    "domain": "constitutional",
    "enactedDate": "1987-02-02",
    "provisions": [
      { "provisionNo": "1", "heading": "National Territory", "body": "The national territory comprises..." },
      { "provisionNo": "2", "body": "..." }
    ]
  }
}
```

`provisionNo` is the number after "Art."/"Article"/"Sec."/"Section" (kept as a
string, uppercased). `heading` is optional. Split real codal text with
`normalizers/statute-normalizer.ts` or produce these files from a source adapter.

## Case line

```json
{
  "kind": "case",
  "record": {
    "sourceUrl": "https://...",
    "retrievedAt": "2026-08-02T00:00:00.000Z",
    "contentHash": "...",
    "citation": "G.R. No. 238875",
    "title": "People v. Dela Cruz",
    "court": "sc",
    "promulgationDate": "2020-06-15",
    "ponente": "Inting, J.",
    "division": "Third Division",
    "passages": [{ "passageNo": 1, "body": "..." }]
  }
}
```

## Issuance line

```json
{
  "kind": "issuance",
  "record": {
    "sourceUrl": "https://www.bir.gov.ph/...",
    "retrievedAt": "2026-08-02T00:00:00.000Z",
    "contentHash": "...",
    "agency": "BIR",
    "issuanceType": "Revenue Memorandum Circular",
    "referenceNo": "RMC 85-2023",
    "issueDate": "2023-06-01",
    "passages": [{ "passageNo": 1, "body": "..." }]
  }
}
```

## Hygiene

- Never fabricate legal text. Only official sources (blueprint §7).
- `contentHash` must match the normalized text; the loader verifies checksums of
  built corpus files independently (blueprint §17).
- Sources change; `retrievedAt` + `sourceUrl` let the corpus signal freshness.
