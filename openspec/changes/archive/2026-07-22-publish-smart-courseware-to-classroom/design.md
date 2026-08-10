## Context

This child consumes a complete courseware draft and the slide runtime's deterministic validation. It owns the irreversible boundary where teacher-private mutable content becomes an immutable catalog and classroom revision.

## Goals / Non-Goals

**Goals:** content-bound gate receipts, explicit goal/module acknowledgements, immutable courseware versions, runtime projection, exact classroom binding, integrity recovery, and full P0 contest demonstration.

**Non-Goals:** authoring new courseware behavior, migrating preset lessons, PDF export, or using AI review as a gate.

## Decisions

### 1. Require two deterministic receipts for one content hash

Static validation checks structure, timing, allowlist, activities, role leakage, goal/module sources, acknowledgements, AI labels, and plan identity. Pinned-browser validation checks rendered geometry. Both receipts are bound to the whole-draft content hash, so any relevant draft edit invalidates them. Individual source-gap acknowledgements are instead bound to stable upstream gap identities: unrelated plan, sibling-module, or ordering edits preserve an unchanged gap acknowledgement, while target content, source-binding-set, canonical-state, or delete-and-recreate changes create a new identity and require a new acknowledgement. Plan approval, editor review, whole-course approval, and projection never imply acknowledgement.

### 2. Freeze publication independently from plan approval

Publication creates `互动课件第N版（基于教案第M版）`. A newer plan produces a warning and requires explicit stale-baseline acknowledgement but does not force regeneration.

### 3. Materialize an existing-runtime projection transactionally

The immutable courseware revision remains authoring truth. Publication creates governed `LessonPlan`, `LessonItem`, and `TeachingResource` projection records. `ClassSession` retains `planId` for compatibility and adds the exact generated revision and manifest hash.

### 4. Never substitute the latest revision

Session launch, runtime, evidence, and finalization resolve the bound revision. Missing or mismatched identity produces a recovery state and integrity incident.

### 5. Make the root-locus demonstration the P0 acceptance

The standard 45-minute lesson uses ordinary course-basis import, the existing Konling `prep-coauthor` session for natural-language task creation, one ambiguity clarification, a later-turn constraint revision, a real configured Provider for manual acceptance, deterministic gates, publication, and student classroom execution. It proves three representative content-quality cases against authoritative source anchors, has no unresolved goal or module source gaps, and visibly labels any prior backup revision.

## Risks / Trade-offs

- [Partial publication writes] -> Use one database transaction and immutable hashes across revision and projection records.
- [Browser receipt drifts by environment] -> Store browser/font/validator versions and rerun after environment changes.
- [Legacy classroom regression] -> Keep the new revision relation nullable and test legacy/preset launch paths.

## Migration Plan

Add nullable publication/revision/receipt/session relations, deploy read compatibility first, then enable generated publication. Existing sessions remain unchanged. Rollback disables new publication while preserving published projections and readable bound sessions.

## Open Questions

None.

## Testing Strategy
Change class: high-risk
Seam status: required
Public behavior: A teacher can publish only the exact deterministically validated courseware draft, see an immutable version in the existing catalog, launch it in a classroom, and retain the same revision through student runtime and finalization.
Public seam: Playwright publication, catalog, waiting-room, teacher runtime, student runtime, and finalization flows backed by real publication transactions, gate receipts, and revision-bound classroom route handlers.
Existing seam reused: Classroom lifecycle routes/tests, manifest hash fields, LessonPlan projection path, Playwright classroom harness, and fixed slide validators.
AC coverage: AC-1: static/browser receipt and invalidation evidence verifies deterministic content-bound eligibility, stable gap-bound goal/module acknowledgement enforcement, no implicit acknowledgement, unrelated-edit preservation, and absence of LLM gate decisions; AC-2: transaction and catalog evidence verifies sequential courseware versions, both canonical pending lineages, individual goal/module source-gap and stale-plan acknowledgements, and immutable projections; AC-3: classroom integration evidence verifies exact revision/hash binding, student-safe runtime, finalization identity, integrity recovery, and legacy compatibility.
Manual-only acceptance: AC-4: external Provider and contest-network execution cannot be deterministic without replacing the real integration under evaluation | record a timestamped real-provider root-locus run covering natural-language task creation, ambiguity clarification, later-turn constraint revision, source-complete content-quality comparison, plan/courseware generation, gates, publication, and student classroom execution with backup labeling.
Rationale: Publication and classroom routes are the highest public seam for the P0 claim, and transaction plus browser evidence proves both immutable identity and actual role-safe runtime while the one external-provider AC remains explicitly manual.
