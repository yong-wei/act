## Context

Existing teacher insight APIs expose class and student metrics, evidence drawers, recommendations, and risk flags. Future control-correction changes will add path outcomes and citation coverage. The missing layer is a stable role-specific diagnosis object that all UI and AI surfaces can reuse.

## Goals / Non-Goals

**Goals:**

- Define diagnosis objects for student overview, teacher class diagnosis, teacher individual consultation, and service/Konling summaries.
- Include claim text, root cause, evidence references, confidence, missing-evidence disclosure, and next-action links.
- Keep raw answer bodies, private memory, hidden Arena internals, and high-frequency traces out of ordinary payloads.

**Non-Goals:**

- Replacing teacher insights or student profile APIs.
- Generating free-form unreviewed model narratives as authoritative diagnosis.
- Building prep packs or grading UI in this change.

## Decisions

### Decision 1: Diagnosis is derived from governed evidence

Diagnosis must consume learner state, feature cache, path summaries, teacher report metrics, and grading summaries through privacy-safe views, not raw table scans.

### Decision 2: Teacher and student views are not the same object with fields hidden

Student diagnosis emphasizes explanation and next actions. Teacher diagnosis emphasizes root-cause clusters, intervention priority, denominators, and class scope.

### Decision 3: Materialized output is versioned

Diagnosis materialization needs a version so reports, prep packs, and Konling can state which rules produced a claim.

## Validation

- Tests SHALL prove student and teacher diagnosis payloads differ in role-appropriate fields and redactions.
- Tests SHALL reject claims without evidence references or confidence state.
- `rtk openspec validate materialize-role-based-diagnosis-views --strict` SHALL pass.
