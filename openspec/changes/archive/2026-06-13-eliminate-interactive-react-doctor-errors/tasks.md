## 1. Baseline and Classification

- [x] 1.1 Re-run the owned-surface React Doctor error gate after `react-doctor-owned-surface-gates` is available.
- [x] 1.2 Filter diagnostics for `src/features/interactive/**` and confirm the expected files and counts.
- [x] 1.3 Classify each finding as identity reset, derived display state, user-editable draft, async envelope, cleanup, or mutable dependency before editing.

Baseline evidence: `artifacts/react-doctor/eliminate-interactive-react-doctor-errors-baseline.json` reported 62 owned error diagnostics, including 14 under `src/features/interactive/**`. The interactive findings were classified as iframe/media reload cleanup, audio and QR async envelopes, activity-card touched draft preservation, panel option identity resets, and Unit 3 step-owned reveal/workspace resets.

## 2. Implementation

- [x] 2.1 Fix `lesson-entry-media-hub.tsx` media and audio state synchronization without changing media tracking semantics.
- [x] 2.2 Fix `manifest-runtime/activity-renderers.tsx` draft/saved-response synchronization while preserving touched draft behavior.
- [x] 2.3 Fix `teacher-join-qr-dialog.tsx` and `multi-representation-linkage/page-client.tsx` state reset findings.
- [x] 2.4 Fix Unit 3 workspace and step-panel findings with identity-keyed or derived-state patterns.
- [x] 2.5 Add focused tests for at least one step identity reset and one same-identity draft preservation case.

## 3. Verification

- [x] 3.1 Run the targeted tests added or affected by this change.
- [x] 3.2 Run the owned-surface React Doctor error gate and confirm zero diagnostics for `src/features/interactive/**`.
- [x] 3.3 Run any relevant interactive manifest/runtime tests touched by the implementation.

Verification evidence:

- `npm run test:unit -- src/features/interactive/__tests__/per-card-response-utils.test.ts src/features/interactive/__tests__/unit-3-1-course.test.ts src/features/interactive/__tests__/interactive-manifest-runtime.test.tsx` passed 3 files / 65 tests, including same-step touched draft preservation and step/card identity reset helper coverage.
- `openspec validate --changes --strict` and `openspec validate --specs --strict` passed after archive.
- `git diff --check` passed.
- `artifacts/react-doctor/eliminate-interactive-react-doctor-errors-final.json` reported 48 owned error diagnostics with 0 under `src/features/interactive/**`; the remaining 48 diagnostics are under `src/resources/**` and belong to `eliminate-resource-react-doctor-errors`.
