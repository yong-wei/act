## 1. Inventory

- [x] 1.1 Extract current module hygiene warnings by rule, surface, and file.
- [x] 1.2 Mark route files, framework-required config files, generated-style entrypoints, stylesheet/runtime side-effect entrypoints, registry entrypoints, dynamic import targets, test helpers, and public API surfaces as protected until proven removable.

## 2. Cleanup

- [x] 2.1 Remove or privatize safe unused local exports with graph evidence.
- [x] 2.2 Split non-component exports out of component files where it improves boundaries without churn.
- [x] 2.3 Remove dead files only when graph, tests, and route conventions agree.
- [x] 2.4 Address barrel imports, dynamic import candidates, circular dependencies, and unused dependencies in separate scoped commits or tasks.

## 3. Validation

- [x] 3.1 Run TypeScript, lint, and focused tests for touched module families.
- [x] 3.2 Run codegraph/CRG or equivalent import evidence for deleted or moved exports.
- [x] 3.3 Run owned-surface React Doctor warning evidence and report targeted hygiene deltas.
- [x] 3.4 Run owned-surface error and Security gates and confirm zero selected diagnostics.
- [x] 3.5 Run `rtk openspec validate prune-owned-surface-module-hygiene --strict`.
