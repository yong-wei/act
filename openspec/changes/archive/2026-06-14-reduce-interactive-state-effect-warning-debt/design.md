## Context

High-signal warning families:

- `no-pass-data-to-parent`: 228.
- `no-pass-live-state-to-parent`: 60.
- `no-prop-callback-in-effect`: 61.
- `no-derived-state`: 70.
- `no-derived-state-effect`: 18.
- `no-reset-all-state-on-prop-change`: 8.

Representative examples include effect-triggered parent callbacks in classroom components and step reveal state synchronized from props in manifest runtime renderers.

## Decisions

1. Preserve identity boundaries first.
   - Step-owned state resets only when step/activity/module identity changes.
   - Same-identity rerenders preserve learner and teacher local work.

2. Prefer event-driven parent updates.
   - User actions may call parent callbacks directly.
   - Effects should not push derived live state upward unless the effect owns an external subscription.

3. Prefer derived values over mirrored local state.
   - Local state is allowed for user-owned drafts and progressive reveal, but the owner identity must be explicit.

4. Use representative batches.
   - Do not attempt to clear every warning in one implementation.
   - Each batch declares exact rule/file scope and preserves behavior with focused tests.

## Risks

- Some effect callbacks intentionally report progress or analytics. Those should be converted to event-based reporting, not removed silently.
- Step reveal and teacher release semantics can regress if local and teacher-owned reveal counts are merged incorrectly.
