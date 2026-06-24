## Context

This change covers the active-platform subset of React Doctor state/effect errors:

- shared components and providers
- `src/hooks/use-mdx-content.ts`
- Arena preview/submission components
- Control Workbench presets and shell
- Knowledge graph/resource panel components
- Admin system config dashboard
- Lesson engine orchestrator builder

These surfaces are active product paths. The implementation should be behavior-preserving and test-led for state reset semantics.

## Goals / Non-Goals

**Goals:**

- Remove `no-adjust-state-on-prop-change`, `effect-needs-cleanup`, and `no-mutable-in-deps` diagnostics from shared and active platform files.
- Preserve existing visible behavior for selection, panel expansion, preview, theme, admin status, and workbench state.
- Establish repair patterns that sibling changes can reuse.

**Non-Goals:**

- Do not touch `src/features/interactive/unit-*` or legacy `src/resources/*` findings.
- Do not address warning-level React Doctor diagnostics.
- Do not refactor product flows beyond what is required for error removal.

## Decisions

1. **Classify before editing.**

   Each finding must be classified as derived display state, intentional identity reset, user-editable state, timer/subscription cleanup, or mutable dependency. The fix depends on that classification.

2. **Prefer local behavior-preserving fixes.**

   Active platform surfaces are not the place for broad architecture changes. Use derived values, key boundaries, cleanup functions, or small helper extraction only when it reduces repeated risk.

3. **Test representative state semantics.**

   React Doctor clean output alone is insufficient. Tests must cover at least one prop identity reset, one user-edited state preservation case, and any timer/subscription cleanup touched.

## Risks / Trade-offs

- **Reset behavior can subtly change.** → Add focused tests around prop identity changes before relying on React Doctor output.
- **Hooks may have hidden consumers.** → Search call sites before changing hook signatures or return shape.
- **Active UI surfaces may be hard to fully test.** → Pair unit/component tests with route or browser smoke checks for changed high-risk surfaces.
