## 1. Native gate, predecessor, and current subject

- [x] 1.1 Verify the mapped Issue is claimable and #1881 is closed with `status:archived`; read the archived A/C subject, schema, package, compact projections, full-inventory locator, byte count, and digests as immutable predecessor evidence without reopening or rewriting either change.
- [x] 1.2 In an independent clean subject checkout, resolve the claim-time `origin/integration` commit/tree, capture the complete tracked-entry and byte-denominator identities, and reject dirty, mixed, detached-unresolved, non-integration, or changing source state.
- [x] 1.3 Record the predecessor-to-current path/blob delta, including every newly tracked payload, while proving that the proposal revision and final artifact commit are not used as the frozen subject.

## 2. Independent classifier checkpoint and denominator closure

- [x] 2.1 Create one clean classifier/validator checkpoint with `toolCommit`, `toolTree`, schema version, entry-bundle digest, and frozen evidence-input digests, separate from the subject checkout.
- [x] 2.2 Rebuild the complete current tracked denominator and required release/runtime, artifact, architecture JSON, archived evidence, generated asset, fixture/snapshot, infograph, PPTX, PPM, EMF, GLB, JSON-family, and other discovered slices from Git object identities and sizes.
- [x] 2.3 Reconcile each current path exactly once to `qualified | unresolved | justified-excluded`, reconcile per-slice and global path and byte equations, and keep ignored/untracked/materialized/remote inputs as separate generated-input observations.

## 3. Existing evidence-authority adapters

- [x] 3.1 Map the current content/knowledge/runtime release manifests, selectors, receipts, blob lifecycle, materializers, recovery roots, and toolchain inventories through digest-bound read-only adapters; preserve candidate, active, rollback, historical, and materialized roles separately.
- [x] 3.2 Map the existing QA evidence lifecycle, archived OpenSpec evidence, architecture sources, generated-asset producers, and test/tool/document consumers without creating another registry or inferring authority from names, versions, directories, or equal hashes.
- [x] 3.3 Enumerate production, test, tool/script, documentation, import/path-read, worker, service, CI, dynamic, and declared remote consumers; retain any unproved remote/OSS fact, count drift, or incomplete consumer boundary as unresolved without invoking server operations.

## 4. A-F classification, facets, and eligibility

- [x] 4.1 Apply the existing unique A-F primary class, fixed `F > C > D > E > A > B` precedence, orthogonal facets, homogeneous-family, and duplicate-observation rules to every current member.
- [x] 4.2 Resolve predecessor `missing-authority-manifest`, `unknown-privacy`, consumer, retention, recovery, rollback, and toolchain-count findings only from current digest-bound evidence; never suppress, inherit, or default a missing fact.
- [x] 4.3 Compute `futureEligible` only when canonical source, complete consumers, retention/deletion condition, zero-required-consumer proof, immutable locator/hash, materialization/recovery/rollback, privacy approval, and all subject/tool identities close together; keep the result action-neutral.

## 5. Full inventory, compact package, and privacy

- [x] 5.1 Write the full current inventory as a reproducible local/CI artifact with a logical locator, byte count, SHA-256, subject/tool/schema identities, and member denominator; independently read and hash the actual bytes and index the verification receipt.
- [x] 5.2 Emit compact summary, index, policy matrix, unresolved register, eligibility register, predecessor/current delta, artifact index, and handoff with stable ordering and a non-self-referential package digest.
- [x] 5.3 Scan the full inventory, every member and evidence locator, every compact projection, and the verification receipt for credentials, cookies, user/learner identifiers, raw answers/events, private locators, absolute paths, binary bodies, or other forbidden data; qualify known F records only with approved safe metadata.

## 6. All-or-unqualified and no-mutation gates

- [x] 6.1 Report `qualified` only when unresolved is zero, path and byte denominators reconcile, all actual artifact bytes and digests validate, lifecycle checks are clean, and package-wide privacy passes; otherwise emit one bounded unqualified package with no migration-ready handoff.
- [x] 6.2 Add pre/post guards proving that classification does not delete, move, rename, externalize, upload, download, materialize, publish, activate, roll back, or garbage-collect payload and does not mutate selectors, OSS/runtime state, databases, CI, Git history, test commands, active baseline, charter, or fitness authority.
- [x] 6.3 Preserve #1876/#1881 artifacts and identities byte-for-byte and label the new output as non-active planning evidence; leave all downstream Issue creation and N5 activation outside this change.

## 7. Focused verification

- [x] 7.1 Extend focused classifier tests for clean-current capture, independent predecessor/subject/tool identities, post-predecessor entries, path/byte conservation, family homogeneity, duplicate non-authority, and current-input drift.
- [x] 7.2 Cover missing or mismatched lifecycle evidence, consumer and toolchain drift, unknown and known-sensitive privacy, actual full-inventory byte verification, missing/truncated/substituted detail artifacts, privacy injection on every output surface, self-hash rejection, all-or-unqualified status, and no-mutation behavior.
- [x] 7.3 Run the existing read-only content/knowledge/runtime and QA evidence lifecycle compatibility checks plus the focused payload-classification test suite; run `rtk npm run typecheck` when TypeScript implementation changes.
- [x] 7.4 Run `rtk openspec validate complete-current-repository-payload-eligibility-classification --type change --strict`, validate the affected canonical spec, and run `rtk git diff --check` before delivery.

## 8. Handoff

- [x] 8.1 Produce a digest-bound handoff containing only the frozen current subject, immutable predecessor, tool and schema identities, reconciled totals, compact projection locators, actual full-inventory locator/byte-count/SHA-256/verification receipt, qualification status, and bounded unresolved reasons.
- [x] 8.2 Confirm the final diff contains only this change's implementation, tests, and compact outputs and no source-payload or lifecycle mutation; do not create a migration Issue or claim that classification authorizes action.
