## Why

Runtime-first courses still expose course-specific entry, teacher, student, waiting, and state/evidence paths even when their content is already a manifest. That makes the shared classroom contract difficult to prove end to end. A representative vertical slice is needed before retiring the remaining private bridges.

## What Changes

- Migrate `unit-1-2-modeling-from-object-to-system` as the representative runtime-first course to the shared classroom shell, immutable course bundle/session binding, extracted classroom use cases, live/evidence split, and manifest plugins.
- Route its teacher, student, and waiting entry points through one shared session mechanism while retaining the current canonical lesson identity and DB BOPPPS/generated-courseware behavior.
- Unify submission, teacher reveal/projection, knowledge-card, and media entry behavior through the existing shared contracts, preserving soft degradation for optional surfaces.
- Characterize existing behavior before migration and retain a behavior matrix plus browser evidence for teacher and student roles.
- Delete the course's private route/component authorities after callers move; do not leave a second private implementation behind a facade.

## Capabilities

### New Capabilities

- `manifest-course-shared-classroom-shell`: Defines the qualified pilot slice, shared teacher/student session shell, bundle/plugin/evidence integration, behavior preservation, and private-authority deletion gates.

### Modified Capabilities

None. `interactive-lesson-identity-resolution`, `manifest-submission-evidence`, `interactive-course-standard-module-migration`, `session-finalization-quality`, `interactive-course-accessibility-semantics`, and the existing shell/UI contracts remain authoritative.

## Impact

- Pilot denominator: the canonical `1-2` identity, its runtime manifest under `course-content/runtime/lessons/1-2`, the entry/student/teacher/waiting routes under `src/app/interactive-learning/courses/unit-1-2-modeling-from-object-to-system`, the corresponding `src/features/interactive/unit-1-2-modeling-from-object-to-system` files, and every direct session/evidence/media/knowledge-card caller.
- Depends on `define-course-bundle-classroom-session-contract`, `extract-classroom-session-application-service`, `separate-classroom-live-state-from-submission-evidence`, and `introduce-manifest-runtime-plugin-contract`. It coordinates with `add-default-teacher-class-launch-selection` and `unify-interactive-lesson-component-style`; it does not reimplement their teacher class-choice or visual-style scope.
- The pilot is a prerequisite for route-bridge retirement, not a claim that all 32 runtime-first course families are migrated.

## Scope and Evidence

- **Characterization:** record current route responses, session creation/join/advance/end, student submissions/resubmissions, teacher projection/reveal, knowledge-card/media fallback, accessibility markers, and generated/runtime manifest hashes.
- **Migration and deletion:** move the pilot vertically, remove its old route/component authorities once the caller inventory is zero, and record a rollback boundary that preserves the old implementation only until pilot qualification. No permanent redirect or duplicate shell.
- **Verification:** run pilot unit/contract tests, evidence and session tests, typecheck/lint/build checks required by the affected domain, and Playwright/browser acceptance for teacher/student journeys.
- **Browser acceptance:** teacher launch and waiting, student join, step progression, activity submit/resubmit, teacher reveal and review, media/knowledge-card optional failure, refresh/reconnect, and session finish must match the characterization matrix.
- **Ledger:** maintain pilot inventory, behavior deltas, bundle/plugin/evidence bindings, route/component deletion proof, browser artifact paths, and qualification decision. No claim, deployment, or production selector change.
