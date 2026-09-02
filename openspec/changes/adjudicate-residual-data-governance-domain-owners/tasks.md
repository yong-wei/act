## 1. Coordination gate and immutable inputs

- [ ] 1.1 Before any claim, apply, implementation (including validator or test
  fixture), adjudication run, normalized decision/evidence-record write, or
  qualified projection, verify from live Issue state that #1876 is closed,
  carries `status:archived`, and has its native `blockedBy` dependency
  resolved.  Keep all later tasks blocked when any condition is false or
  unverifiable; only a parent coordination-layer gate-rejection may be output,
  without consuming A or becoming a D result/artifact.
- [ ] 1.2 Receive change A's exact owner-residue subject identity and
  full-inventory artifact locator/digest; verify source commit/tree, schema,
  denominator identity, locator, and digests without guessing a path or using
  a working-tree fallback.
- [ ] 1.3 Re-read the current modular-monolith charter/current-head contracts,
  Learning Record, Assignment, evidence, Arena, simulation, portrait,
  classroom, privacy and retention specs, and the archived C16 ownership map;
  record that B and C are independent and that D creates no parallel catalog or
  ledger.
- [ ] 1.4 If an adjudicator or validator is implemented, create a clean tool
  checkpoint and record `toolCommit`, `toolTree`, schema/tool versions, and
  entry-bundle digest separately from A's subject identity.
- [ ] 1.5 Freeze A subject, tool identity, schema, relevant spec inputs and
  caller/evidence inputs as one bundle; reject missing, dirty, mixed, stale or
  digest-mismatched inputs before writing any qualified result.

## 2. Denominator and caller closure

- [ ] 2.1 Enumerate the exact current A member set for
  `src/lib/data-governance/**`, including every production module, `index.ts`,
  `__tests__/**`, fixture, snapshot, `assets/**`, font, generated/demo/binary
  member and any other captured member; do not use directory size or prefix as
  business-owner evidence.
- [ ] 2.2 Discover and classify every member's production, test-only,
  tool/script, dynamic-load, re-export, documentation, worker, scheduler,
  route/feature and Prisma caller, preserving repository-relative locators and
  relationship kinds.
- [ ] 2.3 Reconcile static imports, dynamic imports, barrel exports, shell/path
  reads, manifest references, worker registration and archive-only references;
  classify historical references as historical rather than current consumers.
- [ ] 2.4 Define one normalized record schema with stable member/family ID,
  exact paths, source identity, current-owner evidence, candidate owner IDs,
  exactly one `accountableOwner` when qualified, caller classes, public
  boundary, authority/privacy/trust facts, separate outcome, status, resolution
  condition, rollback and evidence locators.
- [ ] 2.5 Prove every member has one primary observation or a justified
  exclusion, every qualified in-scope and out-of-scope surface has exactly one
  accountable target domain owner, and every caller is classified; an omitted
  member, owner, caller or mixed family blocks qualification.
- [ ] 2.6 Form a family only when all members share outcome-relevant owner,
  authority, consumer, privacy, lifecycle, retention, trust and deletion
  evidence; split or leave unresolved on any difference.
- [ ] 2.7 Verify that all capability, route, API, model, worker, script,
  registry and test surfaces outside A's `src/lib/data-governance/**`
  denominator retain the canonical exactly-one accountable target domain owner
  requirement and do not receive the residual outcome extension.

## 3. Fixed authority and trust constraints

- [ ] 3.1 Characterize Learning Record paths against the sole online writer
  `src/features/learning-record/ingestion`; prove that Data Governance sinks or
  adapters are not a second writer and preserve canonical identity/dedupe,
  trusted time, outbox, current pointer and processing/state watermarks.
- [ ] 3.2 Apply the archived C16 map: Assignment remains the owner of approved
  snapshot, CAS and idempotency orchestration; investigate
  `math-document-grading-*`, queue, conversion, derivative and processing
  policy under their current boundary without defaulting them to Assignment or
  reopening moved orchestration.
- [ ] 3.3 Preserve LearningFact eligibility as independent from assignment
  ownership and preserve all existing event, revision, replay, retention and
  backfill isolation requirements.
- [ ] 3.4 Preserve `ArenaSubmission` as official score authority; classify
  simulation/Arena LearningFact as privacy-safe auxiliary/context-only unless
  existing source evidence proves otherwise.  Keep preview/open/isolated
  parameters and `profileWeight=0` out of profile evidence.
- [ ] 3.5 Preserve Portrait V2 as primary and StudentCompetency as compatibility;
  retain freshness, confidence, fallback and recommendation eligibility.
- [ ] 3.6 Preserve teacher/class authorization, redaction and independent-
  learner small-sample suppression; keep backfill separate from online writers
  and current pointers.
- [ ] 3.7 Scan the evidence contract for raw answers, event payloads,
  `contextJson`, user IDs, private data, parser/model output, local paths and
  complete logs; represent only safe identity/evidence references.  Any
  high-impact writer, pointer, retention or privacy uncertainty remains
  unresolved and records a later decision-advisor requirement.

## 4. Outcome adjudication and kernel proof

- [ ] 4.1 Preserve exactly one accountable target domain owner for every
  in-scope and out-of-scope charter surface.  For each A-bound residual member
  or homogeneous family, apply exactly one orthogonal outcome: exact
  business-domain owner, strict cross-domain processing kernel, explicit
  operator tooling/backfill boundary, fixture/demo/test/generated asset,
  compatibility/retirement candidate, or unresolved conflict.
- [ ] 4.2 For an exact business-domain outcome, select one existing charter
  domain only when state-machine semantics, public boundary, authority,
  privacy and all caller evidence support it; retain current-owner evidence
  and serialize that domain as the unique accountableOwner independently from
  the outcome.
- [ ] 4.3 For a kernel outcome, independently prove all conditions: at least
  two real business-domain consumers; intrinsic cross-domain fact semantics;
  no single-domain state machine; no direct page ownership; no one-off
  backfill; one unique public API; and an explicit privacy/authority boundary.
  Record exactly one existing domain `accountableOwner`/steward for the kernel
  public boundary, privacy, retention/deletion and maintenance; consumers do
  not substitute for that owner.
- [ ] 4.4 Reject a kernel label when any condition is missing or supported only
  by tests, tooling, a directory name, file size or internal convenience;
  resolve to a domain/tool only with independent evidence, otherwise retain
  `unresolved`.
- [ ] 4.5 For operator/backfill outcomes, record operator authority,
  dry-run/apply mode, frozen input, operation identity, retention, recovery,
  zero-production-consumer condition and explicit online-writer/current-pointer
  isolation, together with exactly one existing domain accountable owner/steward
  for the boundary and maintenance.
- [ ] 4.6 For fixture/demo/test/generated outcomes, record non-production role,
  producer or regeneration proof, retention and caller evidence, and exactly one
  existing domain accountable owner/steward for maintenance; never assign
  production authority from the fixture's directory or name.
- [ ] 4.7 For compatibility/retirement outcomes, record exact replacement,
  all caller classes, zero-consumer proof requirement, deletion condition,
  follow-up change, rollback and trust invariants, and exactly one existing
  domain accountable owner/steward for the boundary and maintenance; do not
  delete or add a forwarding facade.
- [ ] 4.8 Preserve all multi-owner, no-owner, incomplete-caller and
  high-impact authority conflicts as `unresolved`; include safe conflicting
  evidence, accountable follow-up owner and resolution condition, and never
  force an owner merely to qualify the projection.  Any such record blocks both
  scoped and global charter qualification.
- [ ] 4.9 Emit the compact decision matrix and owner/kernel/tool/fixture/
  compatibility/unresolved summaries with reconciled counts and stable IDs;
  serialize `accountableOwner` separately from outcome and keep duplicate
  observations orthogonal to member disposition.

## 5. Charter, deprecation and migration-ready projections

- [ ] 5.1 Generate the scoped owner/deprecation projection from the existing
  normalized charter record vocabulary and one record set; do not create a
  second owner catalog, charter, or ledger.
- [ ] 5.2 Mark the scoped charter projection qualified only when the denominator
  and callers close, identities match, every member has exactly one
  accountableOwner and one qualified outcome, kernel proofs pass, and
  unresolved count is zero.  Preserve the global single-owner gate for
  out-of-scope surfaces.  Otherwise emit only a non-qualified blocker package
  and never call it migration-ready.
- [ ] 5.3 Keep the complete ledger as a local/CI artifact outside Git.  Publish
  only compact safe summaries and a logical full-ledger locator, byte count and
  SHA-256 digest bound to A's subject and the tool/schema identities.
- [ ] 5.4 For every future slice, record exact paths, public boundary, paths
  explicitly not touched, zero-consumer proof, deletion condition, rollback
  reference and trust invariants, plus exactly one existing domain
  accountableOwner/steward for public-boundary, privacy, retention/deletion and
  maintenance obligations.  Include the Learning Record, Assignment evidence,
  portrait/profile, classroom/session, simulation/Arena, knowledge/resource/SAR,
  operator/backfill and compatibility/assets/tests candidate slices defined by
  the design.
- [ ] 5.5 Require every reader of a slice to verify subject/tool/schema and
  frozen-input identities and fail closed on missing, stale, mixed or drifted
  evidence; a slice is a migration input, not an authorization to act.

## 6. Privacy, determinism, validation and no mutation

- [ ] 6.1 Add privacy/path checks over every compact projection and full ledger
  locator artifact; fail closed with only a safe record ID and violation code
  for forbidden content or absolute paths.
- [ ] 6.2 Add deterministic fixtures proving identical output for identical A
  subject, tool checkpoint, schema and frozen inputs, and distinct/fail-closed
  behavior for source, tool, schema, caller, authority or evidence drift.
- [ ] 6.3 Add rejection fixtures for the #1876 gate, missing/mismatched A
  digests, dirty/mixed source, incomplete denominator, duplicate IDs, omitted
  callers, heterogeneous families, unsafe payloads, missing locators, missing
  kernel owner/steward proof, and an out-of-scope API with compatibility outcome
  but no accountable target domain owner.
- [ ] 6.4 Add scope tests proving no source movement, import/export change,
  barrel deletion, Prisma/schema/migration/backfill/replay/retention change,
  LearningFact/Assignment/Arena/portrait/privacy behavior change, Issue action,
  deployment or production-selector mutation.
- [ ] 6.5 Run targeted contract/privacy/determinism/denominator validators and
  `rtk openspec validate adjudicate-residual-data-governance-domain-owners
  --type change --strict`; run `rtk git diff --check` and record any broader
  suites intentionally not applicable to this documentation-only change.
- [ ] 6.6 Produce the final handoff with COMPLETE or non-qualified BLOCKER
  status, exact A subject/tool/schema identities, compact projection digests,
  full-artifact locator/digest, unresolved records and future-slice conditions;
  do not claim, archive, open an Issue, deploy or activate production.
