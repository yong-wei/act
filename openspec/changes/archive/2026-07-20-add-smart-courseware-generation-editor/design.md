## Context

This child begins only after immutable lesson-plan revisions and the generated slide runtime are available. It owns mutable courseware drafting and preview but deliberately stops before publication and classroom projection.

## Goals / Non-Goals

**Goals:** plan-bound structured generation, required activities, teacher editing, selected-module regeneration, verified citations, explicit source gaps, provenance, privacy, and role-safe previews.

**Non-Goals:** new module kinds, free canvas, immutable publication, classroom sessions, PDF export, or changing approved plan goals.

## Decisions

### 1. Bind every draft to one approved plan revision

Generation receives the exact plan hash, goals, BOPPPS timing, step outline, sources, and limitations. Schema guards reject attempts to redesign goals, remove stages, or change duration.

### 2. Reuse durable job semantics at step/module granularity

Initial generation fills 6–24 steps with 1–3 modules. Completed units persist. Selected-module regeneration receives only local context, produces a diff, and cannot mutate siblings, timing, or plan inputs.

### 3. Treat activities as executable response contracts

Pre-assessment, participatory, and post-assessment each require an activity. Objective activities retain answers/explanations; open activities retain expected output/review points. Teacher-only fields are removed by the student projection.

### 4. Preserve source and AI lineage without owning publication acknowledgement

Every module uses the shared canonical source-state values and has verified citation bindings or a stable source-gap identity bound to its content and source state. The editor persists only gap state and identity; the publication child alone creates and invalidates acknowledgement records. Provenance transitions from AI-generated to AI-generated/teacher-edited without erasing the original attempt.

### 5. Derive teacher and student previews from one manifest

Teacher preview adds answers, review points, citations, audits, versions, and validation issues. Student preview uses the actual runtime projection and hides all teacher/provider internals.

## Risks / Trade-offs

- [Local regeneration changes unrelated content] -> Validate an allowed patch path and reject any out-of-scope diff.
- [Answers leak through payload variants] -> Centralize student projection and run deterministic serialized-payload leakage tests.
- [Source gaps are normalized away] -> Persist gap identity separately from ordinary draft approval.

## Migration Plan

Add courseware draft/job/provenance/source records after both dependencies are archived. Enable the editor for approved smart-plan revisions only. Rollback disables generation/edit routes while preserving drafts.

## Open Questions

None.

## Testing Strategy
Change class: high-risk
Seam status: required
Public behavior: A teacher can generate directly renderable plan-bound interactive courseware, review executable activities and sources, edit allowlisted modules, regenerate one selected module, and preview the exact teacher and student role projections.
Public seam: Playwright courseware editor and teacher/student preview flows backed by public draft/job/regeneration routes, deterministic Provider fixtures, Source Pack citations, and the shared generated slide renderer.
Existing seam reused: Manifest renderer, module registry, canonical response/submission tests, citation UI, Provider fixtures, and teacher/student Playwright harness.
AC coverage: AC-1: deterministic-provider and manifest evidence verifies approved-plan binding, six-stage 6–24 step generation, timing, and allowlisted modules; AC-2: response, citation, canonical source-state, stable gap-identity, no-implicit-acknowledgement, provenance, and paired role evidence verifies executable activities and teacher/student separation; AC-3: editor/API evidence verifies add/edit/delete/reorder/resize actions, selected-module-only accepted diffs, job recovery, privacy, and production test-provider rejection.
Manual-only acceptance: none
Rationale: The editor and role-preview seam observes the complete authoring behavior, while structured fixtures force invalid scope, answer leakage, canonical source-state and gap-identity changes, forbidden acknowledgement creation, and provider failure cases before publication exists.
