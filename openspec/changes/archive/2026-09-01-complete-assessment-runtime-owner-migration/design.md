## Context

The predecessor path-owned attempt change is already archived and `src/features/assessment/public-api.ts` currently exposes `selectNextPathQuestion`, `submitPathAnswer`, attempt context, diagnostic, ability, and mastery reads. `src/features/assessment/application/attempts.ts`, `ports.ts`, `adaptive-persistence.ts`, `adaptive-attempt-context.ts`, and Prisma runtime adapters form the existing path/attempt seam.

At the current HEAD, `src/features/adaptive-assessment` still contains 14 production files. They mix catalog definitions and selection (`adaptive-assessment-item-catalog.ts`, `adaptive-assessment-catalog-selection.ts`, `adaptive-assessment-catalog-selector.ts`), assessment evidence and lifecycle coverage, reviewed question-set data, and generated-candidate persistence/governance/runtime. Routes and scripts import both feature roots, including assessment generation/review/publish routes, learning-path execution, catalog checks, and data-governance commands. The split is an ownership problem even where the behavior is already correct.

The archived 2026-08-28 contracts already define durable attempt identity, reviewed catalog eligibility, immutable item snapshots, human review authority, and safe LearningFact materialization. This change must consume those contracts and must not restate them as a new attempt or catalog model.

## Goals / Non-Goals

**Goals:**

- Give every product-runtime assessment capability one accountable Assessment owner and one public/application boundary.
- Separate student/runtime reads from generation, semantic review, publication, and coverage tooling while retaining their provenance and review authority.
- Migrate every production consumer and delete only runtime paths proven to have zero production imports.
- Preserve response shapes, error classes, idempotency, ordering, privacy, immutable snapshots, and historical data.

**Non-Goals:**

- Re-design question selection, scoring, mastery, catalog policy, generation governance, or diagnosis algorithms.
- Delete `Question`, `UserAnswer`, `AdaptiveAssessment*`, `LearningFact`, publication receipts, or historical answer records.
- Create a new feature flag, persistence fallback, catalog schema, attempt schema, or parallel Assessment API.
- Deploy, change runtime release content, migrate production data, or activate a selector.

## Decisions

1. **Assessment owns product runtime semantics.** Runtime item identity, reviewed-item selection, attempt context, scoring/mastery reads, diagnostic reads, and evidence authority live behind Assessment public/application contracts. A directory named `adaptive-assessment` cannot remain a competing owner.
2. **Runtime and tooling are classified before moving files.** Catalog selection and immutable snapshots needed by request-time code are runtime. Candidate generation, semantic review, coverage reports, and publication orchestration are toolchain/authoring concerns, even when an authenticated admin route invokes them; their domain owner remains Assessment and their imports must not pull request-time code into generators or vice versa.
3. **One consumer migration is preferred over a permanent bridge.** Update routes, workers, scripts, and tests to import Assessment contracts, then delete obsolete runtime files. A temporary compatibility export is permitted only if a consumer cannot move atomically; it must carry an owner, exact consumer list, replacement, deletion condition, and the follow-up C2 retirement record.
4. **Historical persistence is retained.** Moving source ownership does not move or delete tables, snapshots, generated publication receipts, or LearningFact history. Existing adapters may remain when another domain owns the table, but no second path-owned write authority may survive.
5. **Behavior is locked by characterization.** Before moving a file, capture current main-path, error, retry, concurrency, review-state, snapshot, companion-practice, and student-safe projection behavior. Tests migrate with the canonical implementation; only tests that prove a deleted path or duplicate wrapper may be removed.
6. **No release action is part of this change.** The result is code and OpenSpec evidence only. Production behavior and selectors remain unchanged until an independently authorized implementation/release workflow.

## Risks / Trade-offs

- [A generation/review file is moved into request-time code or vice versa] → classify imports and execution context first; run production/tools TypeScript graphs and route/tool smoke checks after migration.
- [A hidden dynamic import keeps the old runtime owner alive] → scan static imports, dynamic loads, re-exports, package aliases, route references, workers, scripts, and tests at the exact post-migration revision.
- [A response or error compatibility detail changes during relocation] → run existing Assessment route/unit/contract characterization tests unchanged before deleting old paths.
- [Historical tables are mistaken for obsolete business authority] → preserve tables and adapters unless a separate data-migration change explicitly owns them; only remove duplicate path-owned code.

## Migration Plan

1. Consume the qualified C0 current-head delta and enumerate the 14 adaptive-assessment production files, all consumers, and active-change overlaps.
2. Add or confirm characterization tests at the current Assessment public/application boundary.
3. Classify and move runtime code into Assessment-owned modules; place generation/review/coverage code behind an explicit Assessment toolchain boundary without introducing a second API.
4. Migrate routes, workers, scripts, dynamic imports, re-exports, and tests. Run a zero-production-import scan for every retired path.
5. Remove obsolete adaptive-assessment runtime files and any duplicate tests only after the scan and focused verification pass. Record moved/deleted paths and before/after ownership evidence.
6. Rollback by restoring the prior code revision if verification fails; do not restore a legacy runtime facade or alter persisted data.

## Open Questions

- Which Assessment-owned subdirectory best distinguishes request-time catalog reads from toolchain generation/review while preserving the repository's existing `public-api`/`application`/`ports` convention?
- Are any currently active admin generation routes required to remain in the web compilation graph, or can their implementation-only helpers move to the tools graph without changing their HTTP contract?
