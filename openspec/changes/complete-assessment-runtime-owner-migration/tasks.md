## 1. Predecessor evidence and consumer denominator

- [ ] 1.1 Consume the qualified C0 delta at its exact source identity and confirm the archived 2026-08-28 attempt/catalog/persistence contracts that remain authoritative.
- [ ] 1.2 Inventory all 14 production files under `src/features/adaptive-assessment`, classify each as Assessment runtime, Assessment toolchain, or historical/test-only, and record the target path and deletion condition.
- [ ] 1.3 Enumerate production routes, workers, scripts, dynamic imports, re-exports, package aliases, and tests that reach the classified files; cross-check active OpenSpec changes before editing.

## 2. Characterization and ownership migration

- [ ] 2.1 Run the current Assessment public/API and catalog characterization tests for next-question, answer submission, companion practice, diagnostic/ability reads, reviewed eligibility, item snapshots, error paths, and duplicate/concurrent requests; preserve expectations.
- [ ] 2.2 Establish the Assessment-owned runtime boundary for catalog identity/selection, evidence authority, attempt context, and durable attempt adapters without creating a second public API or schema.
- [ ] 2.3 Move generation, semantic-review, lifecycle-coverage, and publication helpers to an explicit Assessment toolchain/authoring boundary where required, preserving source hashes, review decisions, lineage, and publication receipts.
- [ ] 2.4 Migrate every production route, worker, script, dynamic load, re-export, and test to the Assessment boundary; remove obsolete deep imports and update only path-protection tests that no longer represent a live contract.
- [ ] 2.5 Verify old `adaptive-assessment` runtime paths have zero production imports before deleting them; leave any unresolved consumer as a blocking record rather than adding a facade.

## 3. Verification and handoff

- [ ] 3.1 Run focused Assessment unit/contract tests and route characterization for catalog selection, attempt persistence, diagnosis, generation/review/publish compatibility, and privacy/error behavior.
- [ ] 3.2 Run `rtk npm run typecheck`, the relevant production/tools TypeScript graphs, and the architecture fitness/import scan at the exact intended revision.
- [ ] 3.3 Compare before/after runtime ownership, production import count, deleted paths, test set, and public exports; confirm no Prisma schema, release, selector, or data changes.
- [ ] 3.4 Run `rtk openspec validate complete-assessment-runtime-owner-migration --type change --strict` and record the exact result.
- [ ] 3.5 Record rollback revision, retained historical tables/adapters, unresolved non-blocking tooling concerns, and the handoff prerequisite for C2.
