## 1. A gate and identity locking

- [ ] 1.1 Before claim, apply, implementation, test, or capture, verify from live GitHub state that Issue #1876 is closed, carries `status:archived`, and has native `blockedBy` dependencies resolved; otherwise leave this change blocked and do not fabricate the relationship.
- [ ] 1.2 Load A's immutable successor envelope and verify the subject identity (`successorCaptureId`, `sourceCommit`, `sourceTree`, successor digest), schema/version, complete artifact locator, byte count, and SHA-256; confirm it is not `REQUIRED_BASELINE`, `REQUIRED_FITNESS_BUDGET`, or an active baseline selector.
- [ ] 1.3 If B changes a collector, projector, or validator, create a clean tool implementation checkpoint and record `toolCommit`, `toolTree`, schema/version, and entry-bundle digest; if no tool code changes, explicitly record tool identity equal to subject identity rather than leaving it implicit.
- [ ] 1.4 Run governed commands in an independent clean subject checkout or have the clean tool checkout consume subject-checkout output; reject dirty/mixed/unresolved worktrees, perform a second subject/tool identity read before writing any receipt or conclusion, and fail closed on subject/tool or artifact drift. The final artifact commit must not be recorded as the subject identity.

## 2. Universe and declaration closure

- [ ] 2.1 Re-read the qualified command/discovery contracts and map the existing `scripts/test-command-contracts.ts` and `src/lib/architecture-test-commands/**` universe, declaration, result, receipt, disposition, and release authorities without creating a parallel registry or runner.
- [ ] 2.2 Independently enumerate the version-controlled test universe from the supported naming conventions and explicit exclusions, then reconcile it forward and reverse against every actually registered default, unit, contract, integration, critical E2E, release, nightly, Rust/WASM, OpenSpec, commercial-UI, and other governed root/classification.
- [ ] 2.3 Record discovered, represented, excluded, duplicate, and unresolved totals from the generator output; require stable repository-relative identities and make missing roots, classifications, declarations, or exclusions blocking rather than silently omitting them.

## 3. Governed lane execution and receipts

- [ ] 3.1 Freeze the command matrix and execute every scope actually registered by the existing contract, including default, unit, contract, integration, critical E2E, release, nightly, Rust/WASM, OpenSpec, commercial-UI, and other declared specialized lanes; preserve each lane's registry-declared scope/requiredInputs and do not widen, narrow, retry, skip, or otherwise alter command scope.
- [ ] 3.2 Emit deterministic discovery/result cores and separate immutable environment measurement receipts, each bound to the exact subject identity, tool identity, command ID, scope, command-docs/entry-bundle digest, tool versions, cache mode, exit status, counts, and bounded fingerprints; deterministic equality is required only for the same subject/tool/frozen inputs.
- [ ] 3.3 Preserve a per-lane denominator and pass/non-clean/BLOCKED status for default, release, nightly, PostgreSQL, full Playwright, and other non-default lanes; missing release manifests or `nightly-not-run` must remain visible in their own lane and may affect another lane only through an explicit registry dependency.
- [ ] 3.4 Capture missing, unavailable, timeout, permission, plan, browser, database, provider, or other external conditions as safe bounded blockers with owner and resolution condition; never replace unavailable evidence with a passing result or unverified local fallback.

## 4. Fingerprint, root-cause, and planned disposition

- [ ] 4.1 Normalize each current failure, unhandled error, unregistered skip, unresolved discovery item, and unavailable registered scope into a stable fingerprint retaining command/lane, test identity, stage, safe error class/summary, artifact identity, subject identity, and tool identity; cluster only demonstrated common roots while preserving every member.
- [ ] 4.2 Assign each fingerprint exactly one planned `FIX`, `DELETE`, `QUARANTINE`, or `BLOCKED` disposition with owner, root-cause/evidence locator, lane, closure or resolution condition, and applicable expiry; reject accepted, silent-skip, flaky-retry, or unregistered values.
- [ ] 4.3 Represent `release-input` only as a `QUARANTINE` subtype with a named non-default release-qualification lane, owner, reason, expiry, and migration condition; represent `external-blocker` as `BLOCKED`; keep either item blocking the default lane only while it remains in a default scope or the registry explicitly declares it as a default dependency, and otherwise retain it as a blocker for its own lane until governed closure is proven.
- [ ] 4.4 Do not execute any planned FIX/DELETE/QUARANTINE action, modify product or test assertions/timeouts/skips/retries/runners, or remove a test as part of this change.

## 5. Compact outputs and privacy

- [ ] 5.1 Generate the compact manifest/package containing A subject identity, tool identity, command/lane manifest, per-lane denominator/status, denominator closure summary, receipt index, bounded failure/disposition summary, conclusion state, and complete logical artifact locator/byte-count/SHA-256 index.
- [ ] 5.2 Keep raw logs, full per-test ledger, private content, media/screenshots/models, credentials, learner/user identifiers, raw answers/events, and absolute machine paths outside Git; run privacy validation and fail closed with only a safe violation code when forbidden content appears.
- [ ] 5.3 Re-project the compact package from the same deterministic inputs and frozen receipt identities, verify byte-identical deterministic outputs and all recorded digests, and reject missing/stale/mismatched locators without best-effort substitution.

## 6. Clean/non-clean conclusion

- [ ] 6.1 Compute the default PR conclusion only from current outputs for the existing registry-declared default mandatory scope/requiredInputs: issue a clean certificate for this exact subject/tool identity only when those scopes have valid receipts and failures, unhandled errors, unregistered skips, unresolved discovery, source/tool/receipt drift, and unclosed dispositions are zero.
- [ ] 6.2 Compute independent pass/non-clean/BLOCKED conclusions for each non-default release, nightly, PostgreSQL, full Playwright, and other registered lane; missing release manifests, `nightly-not-run`, or an unrun non-default lane must not contaminate default clean or disappear from the global summary.
- [ ] 6.3 For any default blocker, non-zero required count, unresolved fingerprint, unverified A input, active default quarantine, or registry-declared cross-lane dependency failure, emit a non-clean blocker package with bounded identity, owner, lane, evidence locator, and closure/resolution condition; do not claim clean or generalize proposal-time numbers.

## 7. Handoff and boundaries

- [ ] 7.1 Write the compact handoff and implementation notes so later authorized changes can consume the exact subject/tool identities, successor/source identity, receipts, failure inventory, and planned dispositions; preserve full detail by locator/digest rather than committing a giant ledger.
- [ ] 7.2 Explicitly hand off FIX/DELETE/QUARANTINE execution to a separately authorized follow-up and preserve the distinction between investigation qualification and active baseline/fitness/test qualification; do not open a new Issue or begin N4.

## 8. Focused verification and delivery checks

- [ ] 8.1 Add or update focused contract fixtures for A-gate blocking, subject/tool identity and source drift, bidirectional denominator closure, per-lane isolation and explicit dependencies, deterministic re-projection, privacy rejection, measurement separation, disposition validation, and clean/non-clean conclusion rules.
- [ ] 8.2 Run the focused command/discovery/receipt/disposition contract tests and all governed lane commands required by the registered matrix; retain bounded receipts for pass, failure, skip, unhandled, unresolved, and external-blocker outcomes.
- [ ] 8.3 If TypeScript implementation files changed, run `rtk npm run typecheck`; otherwise document that no TypeScript code was changed and do not claim a typecheck was performed.
- [ ] 8.4 Run `rtk openspec validate reconcile-current-clean-head-test-failure-denominator --type change --strict` and `rtk git diff --check`; verify the final diff contains only this change directory and no active baseline, fitness budget, CI, product, test, release, or GitHub state mutation.
