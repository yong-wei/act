## 1. Baseline and Classification

- [ ] 1.1 Re-run the owned-surface React Doctor error gate after `react-doctor-owned-surface-gates` is available.
- [ ] 1.2 Filter diagnostics for `src/features/interactive/**` and confirm the expected files and counts.
- [ ] 1.3 Classify each finding as identity reset, derived display state, user-editable draft, async envelope, cleanup, or mutable dependency before editing.

## 2. Implementation

- [ ] 2.1 Fix `lesson-entry-media-hub.tsx` media and audio state synchronization without changing media tracking semantics.
- [ ] 2.2 Fix `manifest-runtime/activity-renderers.tsx` draft/saved-response synchronization while preserving touched draft behavior.
- [ ] 2.3 Fix `teacher-join-qr-dialog.tsx` and `multi-representation-linkage/page-client.tsx` state reset findings.
- [ ] 2.4 Fix Unit 3 workspace and step-panel findings with identity-keyed or derived-state patterns.
- [ ] 2.5 Add focused tests for at least one step identity reset and one same-identity draft preservation case.

## 3. Verification

- [ ] 3.1 Run the targeted tests added or affected by this change.
- [ ] 3.2 Run the owned-surface React Doctor error gate and confirm zero diagnostics for `src/features/interactive/**`.
- [ ] 3.3 Run any relevant interactive manifest/runtime tests touched by the implementation.
