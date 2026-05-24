## Context

The standard student submission path is `interactive-manifest.json` -> `useManifestSubmissionController` -> `manifest-submission-v2` -> `/api/interactive/events` -> `StudentStepResponse` and `LearningFact` evidence. The early classroom units still use lesson-local submit event calls and cannot be enforced by the existing manifest submission gate.

## Goals / Non-Goals

**Goals:**

- Bring 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 into the same runtime manifest and submission evidence path as the already migrated lessons.
- Preserve existing classroom page behavior while changing the evidence adapter boundary.
- Extend data-quality gates so every response-producing early unit is inventoried and checked.

**Non-Goals:**

- Do not rewrite finalization in this change; that is handled by `unify-interactive-session-finalization`.
- Do not rewrite course pedagogy or step ordering except where a manifest must express the existing runtime contract.
- Do not keep direct `LESSON_SUBMIT` calls behind a thin adapter.

## Design

1. Generate each early unit manifest from the current runtime contract, page contracts, and existing student-page response steps.
2. Normalize response-producing steps into manifest activity kinds so objective, subjective, parameter, simulation, and custom panels can produce a v2 evidence envelope.
3. Replace direct student-page submit calls with the shared manifest submission controller.
4. Register `CourseEvidenceSpec` entries using manifest-derived metadata plus explicit overrides only where the existing course contract needs them.
5. Expand the submission gate inventory and minimum response-step counts so a missing migration fails tests.

## Risks

- Some early unit steps use custom workspace or calculation panels. Their submitted state must be preserved through structured extra evidence, not dropped into mutable student state only.
- Manifest ids must match existing step ids used by teacher summaries and tests.

## Verification

- Run focused tests for 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4.
- Run `npm run test:course-data-quality-gates`.
- Run `npm run lint`.
