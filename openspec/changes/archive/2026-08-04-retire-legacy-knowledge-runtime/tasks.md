## Series Dependencies

- Depends on: `activate-versioned-knowledge-consumers`.

## 1. Preflight evidence

- [x] 1.1 Inventory all active consumers, authoring/runtime paths, legacy readers, selectors, fallback counters, historical adapters, and rollback artifacts.
- [x] 1.2 Run old-ID scan and produce immutable digest-bound report with zero new-content violations.
- [x] 1.3 Export fallback hit counts/evidence window and verify Canonical LearningFact/Konling activation identities.
- [x] 1.4 Verify one complete ActKG incremental Delta upgrade, full Projection rebuild, consumer activation, and rollback receipt.

## 2. Retirement manifest and review gate

- [x] 2.1 Archive the 34-batch/4,891-member legacy audit manifest, crosswalk, historical snapshots, and rollback artifacts with digests.
- [x] 2.2 Build immutable retirement manifest and fail closed on missing/unknown evidence or attempted activation coupling.

## 3. Narrow removal

- [x] 3.1 Remove obsolete legacy graph/card readers and global CourseCoverage runtime selector dependencies only after the manifest gate passes.
- [x] 3.2 Preserve historical adapters, audit/crosswalk files, snapshots, and LearningFact read compatibility.
- [x] 3.3 Add regression tests proving current consumers resolve new identities and historical records remain readable.

## 4. Verification

- [x] 4.1 Run focused old-ID scan, fallback telemetry, retirement-manifest, removal, current-consumer, rollback, and historical-read tests.
- [x] 4.2 Run `rtk openspec validate retire-legacy-knowledge-runtime --type change --strict` and `rtk openspec validate --changes --strict`.
- [x] 4.3 Confirm this change contains no activation switch, remote deployment, Prisma migration, or upstream semantic review.
