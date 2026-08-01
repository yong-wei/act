## 1. Resolve and freeze the declared snapshot

- [x] 1.1 Resolve the r3 stable chain endpoint and freeze the ReleaseSet, Release, Bundle, Schema, Projection, source digest, accepted import/Delta receipts, ACT capture revision, and resolution digest.
- [x] 1.2 Run the formal Bundle loader, sequential ReleaseSet Delta validation, and 87-migration isolated-database round trip without mixing the prior rejected schema.

## 2. Produce bounded review input

- [x] 2.1 Generate the deterministic 3,609-item CourseCoverage worklist from the frozen v0.8:r3 snapshot and prove identical regeneration.
- [x] 2.2 Record the 1,772 profile-only items as pending evidence and preserve the rule that historical Coverage decisions cannot be reused for the current worklist digest.
- [x] 2.3 Record the nine-role review boundary: the two roles without legal Canonical bindings remain blocked pending separate activity/evaluation and scene-migration contracts; no approximate Mapping is admitted.

## 3. Preserve activation boundaries

- [x] 3.1 Record that CourseCoverage acceptance, Stage 2 Binding/Mapping, handoff, Teaching Projection, and attestation were not entered because independent review is missing.
- [x] 3.2 Record blocked-or-Legacy formal consumers and prove `PRODUCTION_SELECTOR_CHANGE=0` and `GRAPH_RAG_SELECTOR_CHANGE=0`.

## 4. Verify the evidence package

- [x] 4.1 Run the targeted loader, Delta, worklist, and generator checks together with typecheck, `git diff --check`, and strict OpenSpec validation; preserve the immutable receipt at `course-content/authoring/knowledge/issue-1117-v08-r3-chain/metadata/declared-authoritative-snapshot-receipt.json` and verify its digest with the pure validator and tamper tests.
