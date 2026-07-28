## 1. Build the Legacy Archive

- [ ] 1.1 Define and materialize the fixed snapshot of Legacy nodes, relations, revisions, unfinished paths, and node notes.
- [ ] 1.2 Add the independent read-only archive route and contract.
- [ ] 1.3 Preserve prior content authorization, note owner-only access, and administrator audit boundaries.
- [ ] 1.4 Remove edit, Konling, recommendation, resource, path, and learning-fact actions from archive surfaces.

## 2. Prove cutover readiness

- [ ] 2.1 Implement one Cutover Gate covering standard Bundle compatibility, candidate import, accepted ReleaseSet Delta, semantic governance, graph API, Konling, RAG, SAR, KAQ, effective resources, CourseCoverage, paths, Canonical writers, complete course ReleaseSet, and formal Teaching Projection.
- [ ] 2.2 Verify every accepted Release and Overlay is pinned to the intended application and database revision.
- [ ] 2.3 Export the latest production database, restore it locally, and execute the exact intended migration and application revision.
- [ ] 2.4 Validate the candidate graph, all formal consumers, Legacy Archive permissions, historical interpretation, and Canonical writer shadow mode on the restored data.
- [ ] 2.5 Record migration duration, row counts, hashes, failures, and an auditable rehearsal receipt.

## 3. Execute downtime cutover

- [ ] 3.1 Prepare and verify production backup, stop, migration, smoke, rollback-before-write, and forward-repair procedures.
- [ ] 3.2 Stop application, worker, and scheduler and create the production database backup.
- [ ] 3.3 Execute the rehearsed migration and transactionally switch the active ReleaseSet plus resource, RAG, KAQ, SAR, path, and Canonical writer selectors.
- [ ] 3.4 Run required read, permission, archive, worker, scheduler, and Canonical write-boundary smoke checks before reopening.
- [ ] 3.5 Restore the backup and old application only if checks fail before Canonical writes; otherwise keep service stopped and apply a forward repair.

## 4. Retire Legacy runtime

- [ ] 4.1 Remove the main graph Legacy toggle after successful cutover.
- [ ] 4.2 Reset Legacy-node favorites, canvas layouts, and recent-visit records without mapping them to Canonical Objects; preserve node notes only in Legacy Archive.
- [ ] 4.3 Retire the Legacy graph DTO, business API, caches, and formal runtime readers while retaining the archive contract.
- [ ] 4.4 Update `docs/ProjectDescription.md`, deployment runbooks, authority diagrams, and operator recovery guidance.
- [ ] 4.5 Run full typecheck, lint, unit, integration, data-governance, build, production smoke, and strict OpenSpec validation on the final revision.
