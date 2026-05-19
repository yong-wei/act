## Context

The current governance pipeline can reliably materialize a subset of classroom events into `LearningFact`, update snapshots, and feed profile/recommendation surfaces. The platform also stores much broader evidence outside classroom sessions: standalone resource interactions, knowledge graph activity, simulations, adaptive answers, prompt assessments, design sessions, and Arena submissions. Those sources are not governed through one catalog, and most of their high-value records are not visible to `StudentCompetencySnapshot`, `StudentProfileSummary`, or recommendation generation.

The result is a mismatch: raw data volume is high, but profile-ready evidence is sparse. Recent inspection found tens of thousands of simulation and answer records, hundreds of standalone resource interactions, and only a handful of out-of-class `LearningFact` rows. The next governance step is not more instrumentation first; it is a source-to-evidence contract that makes existing data usable, auditable, and efficient for downstream applications.

## Goals / Non-Goals

**Goals:**

- Establish a source evidence catalog for classroom and out-of-class data sources.
- Normalize high-value historical and future records into profile-ready evidence with source traceability.
- Distinguish real student activity from seed, showcase, demo, and test data before profile contribution.
- Keep low-value navigation available for activity context without inflating competency scores.
- Provide an efficient feature/cache layer for profile and recommendation consumers.
- Make recommendation and profile outputs explainable through reason codes and evidence summaries.

**Non-Goals:**

- Replacing the six-dimension competency model.
- Building a new AI recommendation engine in this change.
- Redesigning student or teacher UI layouts.
- Mutating historical raw tables in place.
- Treating every view, click, or navigation event as competency evidence.

## Decisions

### Decision 1: Introduce a governed evidence catalog before adding more scoring rules

The system should first classify existing source tables by scope, provenance, value level, and eligibility. This avoids hard-coding table-specific assumptions into profile and recommendation services.

Alternative considered: directly backfill every raw table into `LearningFact`. That is faster but unsafe because historical `UserAnswer`, prompt, and design records include showcase/seed data that should not be mixed into real student profiles without provenance filtering.

### Decision 2: Use source adapters to normalize raw records

Each source family should have an adapter that converts raw rows into normalized evidence candidates:

- interaction log adapter for standalone resource and knowledge events
- simulation adapter for `SimulationLog`
- assessment adapter for `UserAnswer` and `AbilityAssessment`
- prompt/design adapter for `PromptAssessment` and `DesignSession`
- Arena adapter for `ArenaSubmission`, `ArenaEvaluationRun`, and related context

Adapters should emit stable source ids, evidence kind, source quality, timestamps, domain tags, candidate competency contribution, and raw-source references.

Alternative considered: one generic converter that branches over all tables. That would centralize code but would hide source-specific rules and make evidence quality difficult to audit.

### Decision 3: Separate high-value facts from activity context

High-value outcome records should become `LearningFact` or equivalent profile-ready evidence. Medium/low-value records should contribute to activity summaries, self-directed learning signals, or recommendation context, but should not directly raise competency scores.

Alternative considered: convert all `resource_view` and navigation events into `LearningFact`. That would improve activity counts but would distort competency confidence and reward passive browsing.

### Decision 4: Make backfill dry-run and idempotent

Historical materialization should first produce a coverage report, then run with explicit apply mode. It must deduplicate by stable source identity and avoid creating duplicate facts when rerun.

Alternative considered: immediate background migration. That is risky because source provenance and historical seed exclusion need to be visible before mutation.

### Decision 5: Serve applications from governed facts/features, not raw-table scans

Profile and recommendation APIs should use `LearningFact`, snapshots, summaries, and feature caches rather than scanning `SimulationLog`, `UserAnswer`, or `InteractionLog` on every request. Raw tables remain available for drill-down and audit.

Alternative considered: query all source tables in `/api/user/profile`. This produces richer displays quickly, but it is inefficient and makes each application implement its own evidence semantics.

## Risks / Trade-offs

- [Risk] Historical seed/showcase data could contaminate real profiles. -> Mitigate with source provenance classification, dry-run reports, and default exclusion unless a source is explicitly marked real.
- [Risk] Evidence adapters may overfit current schemas. -> Mitigate with narrow adapter contracts and source-specific tests.
- [Risk] Backfill could duplicate facts. -> Mitigate with stable source keys and idempotency checks before insertion.
- [Risk] Low-value events may still look like learning gains. -> Mitigate by value-level policy that separates activity context from competency contribution.
- [Risk] Feature caches may become stale. -> Mitigate by recording refresh timestamps, source windows, and rebuild commands.

## Migration Plan

1. Produce an evidence coverage report for current local/remote data without mutating records.
2. Add source adapters and tests for high-value source families.
3. Backfill profile-ready evidence in dry-run mode, then apply only eligible real-data records.
4. Refresh student snapshots and profile summaries from governed evidence.
5. Add feature-cache or summary fields consumed by profile and recommendation APIs.
6. Update admin data-governance reporting so coverage, exclusions, and materialization counts are visible.

Rollback strategy: disable new adapter materialization, clear newly generated facts/features by source marker if necessary, and keep raw source tables unchanged.

## Open Questions

- Should the feature cache be a new table or an extension of `StudentProfileSummary`?
- Should historical showcase data stay queryable through a separate demo cohort instead of being excluded entirely?
- What minimum evidence threshold should be required before a recommendation claims a competency weakness?
