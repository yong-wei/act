## 1. Baseline and Scope

- [ ] 1.1 Re-run React Doctor `0.5.1` error-only scan and filter state/effect diagnostics for `src/components`, `src/hooks`, `src/features/arena`, `src/features/control-workbench`, `src/features/knowledge`, `src/features/admin`, and `src/features/lesson-engine`.
- [ ] 1.2 Classify each finding as derived state, identity reset, user-editable state, cleanup, or mutable dependency before editing.
- [ ] 1.3 Search call sites before changing any shared component or hook signature.

## 2. Implementation

- [ ] 2.1 Fix shared components, providers, teacher modal, and `use-mdx-content` findings.
- [ ] 2.2 Fix Arena and Control Workbench state/effect findings.
- [ ] 2.3 Fix Knowledge, Admin, and Lesson Engine state/effect findings.
- [ ] 2.4 Add focused tests for at least one identity reset, one user-edited state preservation case, and each cleanup path touched.

## 3. Verification

- [ ] 3.1 Run targeted unit/component tests for modified shared and active platform files.
- [ ] 3.2 Run representative browser or Playwright smoke checks for changed Arena, Control Workbench, Knowledge, or Admin surfaces.
- [ ] 3.3 Run `npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .` and confirm no state/effect diagnostics remain for this change's files.
