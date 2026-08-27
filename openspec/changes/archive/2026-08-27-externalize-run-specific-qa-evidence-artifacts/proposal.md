# Proposal: Externalize run-specific QA evidence artifacts

## Why

The repository tracks 5,528 files below `artifacts/`, including 1,364
commercial UI files and 2,860 product-design audit files. Several review pages
and simulation/control-workbench surfaces directly import run-specific evidence
or screenshot paths, while commercial UI governance code contains runner and
evidence-root assumptions. A production build must not depend on the outcome
of a particular local or nightly run, and large screenshots, traces, HARs, and
logs should not be versioned as application inputs.

The existing commercial UI governance, product-design audit, and route/evidence
contracts define what must be checked. The active
`stabilize-commercial-ui-qa-capture-contract` change owns the capture runner's
explicit URL, development probe, Dock readiness, staging, and publication
sequence. This proposal supplies the artifact lifecycle and import boundary
without changing that state matrix or any production selector.

## What Changes

- Classify evidence into deterministic representative fixtures, small
  revision-bound manifests/receipts, and run-specific outputs.
- Keep only portable manifests and necessary representative evidence in the
  repository; move large screenshots, traces, HARs, and logs to CI artifacts or
  approved object storage referenced by content hash.
- Remove production/runtime imports of run-specific evidence. Review pages use
  deterministic fixtures or an explicit published evidence package instead.
- Bind every manifest/receipt to source revision, capture/tool version, route,
  theme/viewport/role state, privacy class, and output hash/reference.
- Retain the commercial UI product contract and make missing, stale, mismatched,
  or inaccessible external evidence fail closed in governance checks.
- Migrate references, then delete tracked run outputs that are no longer
  required, recording the deletion and retention decision in a receipt.

No UI selector, runtime behavior, production cutover, or commercial UI state
matrix is changed.

## Capabilities

### New capabilities

- `qa-evidence-artifact-lifecycle`: an explicit lifecycle and privacy-safe
  boundary for deterministic fixtures, run receipts, and external run output.

### Modified capabilities

- `commercial-ui-governance-gates`: add the evidence-source lifecycle contract
  while preserving the existing route, theme, viewport, role, browser,
  readiness, and product-evidence checks.

## Impact

- **Code:** five review pages plus simulation/control-workbench and governance
  evidence references are characterized and migrated; no run-specific file is a
  product import after completion.
- **Artifacts:** the 5,528-file denominator is classified. Large run outputs
  leave the repository; manifests and representative fixtures remain small,
  portable, and content-addressed.
- **Privacy:** credentials, cookies, local absolute paths, user identifiers,
  raw answers, and private audit evidence are rejected from public/runtime
  packages.
- **Dependencies:** requires
  `establish-independent-toolchain-execution-boundary` and the production/tool/
  test graph split. It consumes the active
  `stabilize-commercial-ui-qa-capture-contract` runner contract and existing
  commercial UI/product-design evidence specifications.
- **Coordination:** `coordinate-latest-authority-and-active-oss-cutover` is
  unaffected; this change neither publishes nor activates a runtime selector.

