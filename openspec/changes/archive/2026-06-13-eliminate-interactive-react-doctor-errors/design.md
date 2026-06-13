## Context

The current error-only React Doctor report shows 14 diagnostics in `src/features/interactive`:

- `lesson-entry-media-hub.tsx`: 6
- `manifest-runtime/activity-renderers.tsx`: 2
- `teacher-join-qr-dialog.tsx`: 1
- `multi-representation-linkage/page-client.tsx`: 1
- Unit 3 interactive workspaces and step panels: 4

The dominant rule is `no-adjust-state-on-prop-change`. These findings matter because interactive pages carry local drafts, teacher release state, media state, and course step identity.

## Goals / Non-Goals

**Goals:**

- Remove all React Doctor error diagnostics under `src/features/interactive/**`.
- Preserve same-step user draft state and reset only on explicit course identity changes.
- Keep manifest payload contracts and activity state semantics unchanged.
- Add targeted tests for the riskiest state transitions.

**Non-Goals:**

- Do not redesign interactive course modules.
- Do not migrate legacy resource decks.
- Do not address advisory warning categories unless a warning is directly touched by the error repair.

## Decisions

1. **Classify every finding before editing.**

   Each flagged state update should be classified as derived display state, identity reset, async result envelope, user-editable draft, or cleanup/dependency issue.

2. **Use identity keys for full resets.**

   When state truly belongs to a resource id, step id, activity id, or viewer role, prefer keyed component boundaries or keyed local envelopes instead of effect-based resets.

3. **Preserve drafts on same identity.**

   Draft answers and touched state must not be overwritten merely because a parent re-rendered with equivalent saved response content.

4. **Test behavior, not only lint output.**

   React Doctor clean output is necessary but not sufficient. At least one test should prove identity reset and one test should prove same-identity user edits survive re-render.

## Risks / Trade-offs

- **Manifest runtime changes can affect all standard courses.** Keep changes narrow and add tests around module payload handling.
- **Fixing stale state can accidentally clear user drafts.** Use identity-specific reset conditions and regression tests.
- **Media preview fixes can change iframe/audio behavior.** Verify direct media and preview-source paths separately if touched.
