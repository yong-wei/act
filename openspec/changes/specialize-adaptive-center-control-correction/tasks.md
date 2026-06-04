## 1. Student Center Contract

- [ ] 1.1 Define route, query, and intent handling for `goal=control-correction`.
- [ ] 1.2 Add or extend contract payloads for competency hero, path map, next action, readiness gate, evidence timeline, citation drawer, and Konling dock.
- [ ] 1.3 Preserve compatible behavior for `/assessment/adaptive-practice` and other existing adaptive entries.

## 2. UI States

- [ ] 2.1 Implement path-ready, loading, low-evidence, no-path, no-question, feature-flag-disabled, and network-error states.
- [ ] 2.2 Ensure every empty state is student-facing, actionable, and visually complete.
- [ ] 2.3 Ensure route intent is retained when users enter from homepage, profile, cockpit, or contextual recommendations.

## 3. Verification

- [ ] 3.1 Add component or route tests for the specialized center contract.
- [ ] 3.2 Add browser or Playwright tests for major entry routes and empty states.
- [ ] 3.3 Verify the UI does not expose raw traces, hidden Arena internals, raw answer bodies, or private Konling memory.
- [ ] 3.4 Run `rtk openspec validate specialize-adaptive-center-control-correction --strict`.
- [ ] 3.5 Run the focused UI test and browser validation commands required by the implementation.
