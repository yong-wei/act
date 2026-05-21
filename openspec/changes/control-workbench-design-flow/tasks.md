## 1. Implementation

- [ ] 1.1 Define workbench design-flow types and helper functions.
- [ ] 1.2 Derive flow state from workbench session mode, preset, task, and object visibility.
- [ ] 1.3 Render flow navigation and current-step context in the shell.
- [ ] 1.4 Move bulky shell UI sections into focused subcomponents where needed.
- [ ] 1.5 Preserve existing panel add/remove/reset behavior.

## 2. Tests

- [ ] 2.1 Add tests for challenge, assignment, explore, and black-box flow derivation.
- [ ] 2.2 Add shell rendering tests for flow steps and existing panel controls.

## 3. Verification

- [ ] 3.1 Run targeted workbench tests.
- [ ] 3.2 Run `npm run lint`.
- [ ] 3.3 Run `npm run build` if shell route rendering changes.

## 4. Coordination

- [ ] 4.1 Depends on `arena-training-map`.
- [ ] 4.2 Do not implement view explanation content or feedback scoring in this change.
