## Context

The source catalog phase makes source eligibility reviewable. The next risk is mutation: once historical evidence is converted into facts, it can affect downstream snapshots, profile summaries, and recommendations. This phase must therefore be dry-run-first, idempotent, and tightly limited to catalog-approved source families.

## Goals / Non-Goals

**Goals:**

- Convert eligible high-value historical and out-of-class records into governed, traceable facts.
- Provide dry-run output before any write path is used.
- Preserve raw source tables and write only derived records.
- Make repeated materialization runs deterministic and idempotent.
- Report skipped rows, unsupported sources, and provenance exclusions.

**Non-Goals:**

- Building feature caches or changing profile consumers.
- Recomputing all competency snapshots as part of this change.
- Introducing a new recommendation engine.
- Treating context-only views or navigation as competency evidence.
- Cleaning, deleting, or editing raw historical source rows.

## Decisions

### Decision 1: Catalog eligibility gates every adapter

Adapters must not implement independent eligibility policy. They read the catalog classification from `catalog-out-of-class-evidence-sources` and can only emit candidates for sources marked materialization-ready.

### Decision 2: Dry-run is the review surface

Dry-run output is the primary acceptance artifact. It must show candidate counts, excluded counts, source windows, affected users, and sample source references before apply mode writes derived facts.

### Decision 3: Stable source identity prevents duplicates

Every materialized fact must carry a stable source identity derived from source family, source row id or deterministic source key, canonical event type where relevant, and evidence subtype. Re-running apply mode must not create duplicate facts.

### Decision 4: Preserve raw evidence

Historical raw tables remain the audit base. Materialization creates governance records that point back to raw source references rather than rewriting the original records.

## Risks / Trade-offs

- [Risk] Source rows may lack enough detail for high-confidence competency evidence. -> Emit unsupported or low-confidence exclusions instead of forcing conversion.
- [Risk] Apply mode can affect later analytics. -> Keep this phase limited to derived facts and require dry-run/apply parity tests.
- [Risk] Existing `LearningFact` uniqueness may not cover every source family. -> Define source identity explicitly and test repeat runs.

## Migration Plan

1. Reuse the source catalog as the adapter registry.
2. Add adapter contracts and dry-run aggregation.
3. Add apply mode behind explicit command flags.
4. Add idempotency checks and exclusion reporting.
5. Run against the synced development database and record materialization counts.
