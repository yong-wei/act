## 1. Freeze the observation contract

- [x] 1.1 Capture the implementation commit/tree and enumerate every browser, production Runtime, developer Runtime, and Publisher route/operation class with exact code and configuration owners.
- [x] 1.2 Define versioned source-ledger and observation-envelope schemas with window, timezone, input hash, exporter/tool version, reporting delay, denominator, and qualification fields.
- [x] 1.3 Define closed OSS, ESA, Nginx, Publisher, and developer-mount taxonomies and explicit observed/excluded/duplicate/delayed/unattributed balancing rules.

## 2. Implement safe evidence normalization

- [x] 2.1 Implement fixture-driven importers for the approved OSS/ESA exports, Nginx observations, Publisher metrics, and developer ossfs2 evidence without any cloud mutation.
- [x] 2.2 Implement route/object/endpoint/direction attribution with source-specific balancing and conflict preservation.
- [x] 2.3 Implement allowlist sanitization that rejects credentials, authorization headers, signed queries, raw user data, identifiers, IP addresses, and absolute paths.
- [x] 2.4 Emit deterministic portable receipts and human-readable summaries bound to normalized input digests.

## 3. Capture the current baseline

- [x] 3.1 Collect the available production and workstation observations for one declared window and record every unavailable source or reporting delay.
- [x] 3.2 Reconcile each source ledger to its denominator and leave unsupported attribution explicitly unresolved.
- [x] 3.3 Record current Publisher metadata reuse, new upload, and legacy body-readback bytes without duplicating existing metrics.
- [x] 3.4 Produce an immutable baseline receipt suitable for later ESA and developer-cache comparison without changing live traffic.

## 4. Verification and documentation

- [x] 4.1 Add positive, missing-source, mixed-window, duplicate, unbalanced, taxonomy-conflict, delayed-billing, and sensitive-field rejection fixtures.
- [x] 4.2 Verify repeated normalization of identical inputs produces byte-identical canonical output and no collector performs a write operation.
- [x] 4.3 Document evidence acquisition, privacy handling, vendor accounting boundaries, reporting delay, and the meaning of incomplete versus qualified.
- [x] 4.4 Run focused tests, local typecheck, diff/privacy checks, and strict OpenSpec validation; do not add a `pull_request` GitHub Actions trigger or required integration-PR status check.
