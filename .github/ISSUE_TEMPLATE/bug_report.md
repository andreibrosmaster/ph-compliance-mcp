---
name: Bug report
about: Report a defect in ph-compliance-mcp
title: "[bug] "
labels: bug
assignees: ""
---

## Environment

- ph-compliance version: <!-- e.g. 0.7.0 or commit -->
- Client (Claude Code / Codex / OpenCode / Cline / Cursor / other):
- Node version: <!-- node -v -->
- OS:
- Corpus state: <!-- default download, local override, built from seed -->

## Expected behavior

<!-- What should happen -->

## Actual behavior

<!-- What happened instead; paste the tool output or server stderr -->

## Steps to reproduce

1. …
2. …

## Is this a correctness/legal-accuracy issue?

- [ ] Yes — the server returned law that is wrong, or guessed when it should
      have reported `insufficient_corpus_coverage`.
- [ ] No

If yes, include the exact query and the retrieved citation. **Do not** include
any confidential legal matter.

## Corpus integrity

<!-- If you modified corpus files or used a local override, attach the
content_hash mismatch error if any -->
