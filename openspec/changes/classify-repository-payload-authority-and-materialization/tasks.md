## 1. A Gate and Immutable Input Contract

- [ ] 1.1 Verify from live Issue state that #1876 is closed, has
  `status:archived`, and has its native `blockedBy` dependency resolved; record
  the gate result without creating or editing an Issue.
- [ ] 1.2 Obtain and schema-validate A's immutable successor subject identity,
  capture digest, source revision/tree, scope denominator digest, and complete
  inventory locator/digest; block C claim/apply/implementation/classification
  when any input is missing, stale, mixed, or unreadable.
- [ ] 1.3 Add fixtures for absent, mismatched, and locally substituted A inputs
  and verify that no qualified output is written and no working-tree fallback is
  accepted.

## 2. Scope Denominator and Family Discovery

- [ ] 2.1 Consume A's exact captured entry set and enumerate the required
  `course-content/**/releases/**`, `course-content/runtime/**`, `artifacts/**`,
  `docs/architecture/*.json`, archived OpenSpec evidence, WASM/package/
  generated-asset, large fixture/snapshot, and A-discovered infograph/PPTX/
  PPM/EMF/GLB/JSON family slices.
- [ ] 2.2 Implement stable per-slice discovered/qualified/
  justified-excluded/unresolved member totals and digest reconciliation; keep
  duplicate group/member-reference counts separate; reject any unaccounted
  member, duplicate primary identity, or proposal-time hardcoded count.
- [ ] 2.3 Keep ignored, untracked, generated, and runtime-created inputs outside
  the tracked denominator unless A declares them as separate generated-input
  records with producer/version, class, digest, and source identity.
- [ ] 2.4 Implement family grouping from member evidence and require primary
  class plus every policy-relevant facet (authorship/reproducibility,
  release/rollback, QA, cache/materialized, privacy, retention) and
  provenance/authority/consumer/materialization/recovery homogeneity before
  aggregation; split or unresolved mixed families.

## 3. Classifier Checkpoint and Evidence Collection

- [ ] 3.1 Create one clean classifier/validator tool checkpoint and record
  `toolCommit`, `toolTree`, `schemaVersion`, and entry-bundle digest without
  modifying existing release, QA, architecture, or runtime tools.
- [ ] 3.2 Freeze the A subject, tool, schema, and consumer/provenance evidence
  digests and reject subject/tool/schema/input drift before serialization.
- [ ] 3.3 Build read-only evidence adapters for production, test, tool/script,
  documentation, import/path-read, manifest, worker, service, CI, and
  runtime-discovered consumers, preserving unknown dynamic or remote consumers
  as unresolved.
- [ ] 3.4 Record canonical source, production authority, candidate/staged,
  rollback, and historical states from existing manifests/receipts/selectors;
  verify that directory names, versions, hashes, and current application HEAD
  do not establish authority.

## 4. A-F Classification and Unresolved State

- [ ] 4.1 Implement the typed record contract for path/family, member or family
  hash, safe size, A subject identity, member disposition
  (`qualified | unresolved | justified-excluded`), producer/reproducibility,
  all consumer classes, authority/manifest, retention/privacy, and
  materialization/recovery/rollback conditions, plus orthogonal authorship,
  reproducibility, release/rollback, QA, cache/materialized, privacy, and
  retention facets.
- [ ] 4.2 Assign exactly one primary class to qualified records using the fixed
  priority `F > C > D > E > A > B`: A hand-authored source, B reproducible
  generated output, C immutable release/rollback artifact, D ephemeral QA
  evidence, E cache/materialized view, or F regulated/privacy-sensitive
  evidence. Add tests for D+F→F, B+C→C, B+E→E, and A+F→F while retaining all
  non-primary facets.
- [ ] 4.3 Preserve missing or conflicting evidence as `unresolved` with
  `primaryClass: null` and bounded reason/evidence references; test that no
  seventh class or forced A-F assignment is emitted, that unknown privacy or
  missing critical evidence bypasses precedence, and that the affected slice
  is blocked.
- [ ] 4.4 Bind explicit retention, privacy, materialization, recovery, and
  rollback conditions and preserve existing QA, runtime, knowledge, and
  candidate-production semantics without writing their contracts.

## 5. Duplicate and Future-Eligibility Gates

- [ ] 5.1 Keep every denominator member independently disposed as
  `qualified | unresolved | justified-excluded`; produce deterministic
  exact-duplicate groups from hash plus size and preserve A's near-duplicate
  algorithm, parameters, evidence, and member IDs. Verify duplicate groups are
  observations only, never dispositions, primary classes, evidence
  substitutes, denominator reductions, or authorization for deletion,
  movement, externalization, replacement, or selector mutation.
- [ ] 5.2 Evaluate future eligibility only when canonical source, complete
  consumer list, retention/deletion condition, zero-required-consumer proof,
  immutable locator/hash, materialization/recovery/rollback proof, and privacy
  approval all bind to the same frozen identity.
- [ ] 5.3 Keep any missing, unknown, or drifted future-eligibility proof
  unresolved and verify that `futureEligible` never performs or authorizes an
  action.

## 6. Compact Outputs and Privacy Boundary

- [ ] 6.1 Generate deterministic `summary.md`, `index.json`,
  `policy-matrix.md`, `unresolved.md`, and `future-eligibility.md`, plus a
  complete per-record inventory locator/digest; make `index.json` list only its
  four sibling compact projections (or the explicit versioned actual count)
  and full-inventory identity/digest, never itself or its own hash. Compute
  `packageDigest` only from normalized member identity/digest/disposition and
  subject/tool/schema/frozen-input envelope fields, excluding index bytes.
- [ ] 6.2 Define the policy matrix for Git retention, approved external storage,
  local materialization, CI generation, and rollback/recovery for A-F; keep F
  and unknown privacy ineligible for public externalization and leave actions
  unexecuted.
- [ ] 6.3 Enforce stable ordering and repository-relative/logical locators and
  scan the full-inventory header, every member, every evidence locator, and
  every compact projection for secrets, credentials, cookies, learner/user
  identifiers, raw answers/events, private evidence/locators, binaries, giant
  Git ledgers, absolute paths, and unknown privacy before package qualification.
- [ ] 6.4 Inject credential, cookie, user ID, raw answer, absolute path, and
  private locator values independently into each full-inventory/member/evidence
  locator/compact-projection surface; verify every injection makes the package
  unqualified, while unknown-privacy records retain only safe identity and
  violation code as `unresolved` without source text.

## 7. Validators and No-Mutation Verification

- [ ] 7.1 Add a read-only mutation guard and pre/post subject/input hash check;
  reject deletion, movement, upload/download, materialization, activation,
  rollback, GC, selector, database, CI, Git-history, OSS, and production
  mutation attempts through C.
- [ ] 7.2 Run focused tests for denominator closure, member dispositions,
  one-class/facet precedence, unresolved blocking, family homogeneity,
  subject/tool identity drift, duplicate non-authority, future-eligibility
  gates, package-wide privacy, deterministic serialization, non-self-
  referential package/index digest (including two equivalent runs and an
  explicit self-hash rejection), and no mutation.
- [ ] 7.3 Run existing read-only contract validators for QA evidence lifecycle,
  content/knowledge/runtime toolchains, runtime/OSS manifests and lifecycle,
  and architecture denominator/fitness readers; classify any remote fact they
  cannot prove as unresolved. Run `typecheck:tools` only when the
  implementation adds TypeScript code.
- [ ] 7.4 Run `openspec validate
  classify-repository-payload-authority-and-materialization --type change
  --strict` and the applicable strict repository change/spec validation after
  all artifacts and tests are stable.

## 8. Review and Handoff

- [ ] 8.1 Review every unresolved record and future-eligibility gate against its
  safe evidence locator, confirm no class or consumer was inferred from naming,
  and retain unresolved status where proof is incomplete.
- [ ] 8.2 Produce the digest-bound handoff containing only the exact A subject
  identity/digest, C classifier identity, compact projection locators, full
  inventory digest, and bounded unresolved/eligibility status for downstream
  review.
- [ ] 8.3 Confirm the final worktree diff is confined to this change's
  OpenSpec artifacts and generated classification package, with no payload,
  selector, release, QA, runtime, knowledge, OSS, production, GitHub, or
  downstream Issue mutation.
