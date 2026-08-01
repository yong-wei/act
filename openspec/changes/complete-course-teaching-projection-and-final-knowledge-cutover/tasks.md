## 1. Review the current CourseCoverage input

- [ ] 1.1 Re-resolve the latest eligible ReleaseSet and freeze the current worklist, Release, Delta, authoring revision, and input digest.
- [ ] 1.2 Independently review all 3,609 worklist records and persist one decision per canonical ID with reviewer, evidence, rationale, and current digest.
- [ ] 1.3 Resolve the 1,772 profile-only records with independent evidence or retain an explicit blocking disposition; do not copy historical Coverage verdicts.
- [ ] 1.4 Add deterministic denominator, duplicate, missing-evidence, and digest-drift tests for review assembly.

## 2. Establish the nine-role Mapping contracts

- [ ] 2.1 Define the activity/evaluation capability contract for “仿真验证与跨模型比较”.
- [ ] 2.2 Define the scene-migration capability contract for “现代控制与船海迁移”.
- [ ] 2.3 Review all nine roles through independent Primary and Challenger decisions and require Third adjudication wherever those decisions disagree.
- [ ] 2.4 Persist rejected alternatives, contract kind, evidence rationale, reviewer identities, and Mapping revision; reject approximate knowledge-node bindings.
- [ ] 2.5 Run Mapping reload, conflict, duplicate-candidate, and role-type negative tests.

## 3. Produce and attest the Teaching Projection

- [ ] 3.1 Define the versioned `act-teaching-projection-handoff/1` payload and export the exact Release, CourseCoverage, Mapping, conflict, and digest identities.
- [ ] 3.2 Obtain the formal ActKG Teaching Projection and validate schema, membership closure, relation semantics, source lineage, and digest.
- [ ] 3.3 Record one-time conflict decisions with existing KAQ knowledge-to-knowledge relations and retire superseded relations only after review.
- [ ] 3.4 Add independent attestation, replay, and tamper/drift rejection checks for the handoff and Projection.

## 4. Close all consumer and writer readiness gates

- [ ] 4.1 Produce same-identity readiness receipts for graph, Konling, RAG, SAR, KAQ, effective resources, CourseCoverage, path planning, and Canonical learning-fact writers.
- [ ] 4.2 Add a single atomic selector/writer-fence transaction and prove that any missing or Legacy-bound receipt leaves every selector unchanged.
- [ ] 4.3 Verify persistence, authorization, concurrency, and no-dual-authority behavior for every formal consumer.
- [ ] 4.4 Run consumer smoke tests against the attested Projection and reject engineering-only relations or stage snapshots as substitutes.

## 5. Rehearse the production migration

- [ ] 5.1 Export the latest production database and restore it in an isolated environment with the exact final application revision and schema.
- [ ] 5.2 Execute the final ReleaseSet, Projection, migration, archive, selector, and smoke sequence on the restored data.
- [ ] 5.3 Record hashes, row counts, duration, failures, backup/restore timing, and the approved downtime and rollback thresholds.
- [ ] 5.4 Re-resolve the latest Release immediately before cutover and invalidate the rehearsal if any identity or digest drifts.

## 6. Execute downtime cutover and recovery

- [ ] 6.1 Stop application, worker, and scheduler; create and verify the production database backup.
- [ ] 6.2 Execute the rehearsed migration and one transaction that activates every consumer selector and Canonical writer fence.
- [ ] 6.3 Run read, permission, archive, worker, scheduler, and Canonical write-boundary smoke checks before reopening service.
- [ ] 6.4 Implement rollback-before-write and stopped-service forward-repair procedures with append-only operator evidence.
- [ ] 6.5 Reopen service only after all checks pass and monitor the first Canonical facts under the active writer fence.

## 7. Archive Legacy and retire old runtime state

- [ ] 7.1 Materialize the fixed Legacy Archive snapshot with prior content authorization, owner-only note bodies, and administrator audit metadata.
- [ ] 7.2 Deny graph business, AI, recommendation, resource, path, and learning-fact operations from the archive contract.
- [ ] 7.3 Retire Legacy DTOs, business APIs, caches, formal readers, and the main graph Legacy toggle after successful cutover.
- [ ] 7.4 Reset Legacy-bound favorites, canvas layouts, and recent visits without mapping them to Canonical IDs.
- [ ] 7.5 Add archive permission, historical-link, UI-state-reset, and post-cutover regression tests.

## 8. Final verification and operational handoff

- [ ] 8.1 Run typecheck, lint, unit, integration, data-governance, build, production smoke, and strict OpenSpec validation on the final revision.
- [ ] 8.2 Publish the attestation, rehearsal receipt, selector transaction receipt, archive manifest, rollback evidence, and operator runbook.
- [ ] 8.3 Obtain independent review of the final diff and confirm no unresolved blocking finding or mixed authority remains.
