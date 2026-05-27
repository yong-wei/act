## 1. Student Core Navigation

- [ ] 1.1 Replace the core `student-profile` entry with an `Interactive Learning` entry targeting `/interactive-learning` in the shared role-navigation model.
- [ ] 1.2 Keep `/profile` reachable through account, cockpit, and profile-specific surfaces without counting it as a core student module.
- [ ] 1.3 Update homepage, dashboard, Arena shell, and navigation tests to assert the new six-entry order and profile fallback surfaces.

## 2. Cross-Domain Exploration Catalog

- [ ] 2.1 Remove the hard-coded `综合仿真工作台` / classic four-view workbench card from `/interactive-learning/cross-domain-exploration`.
- [ ] 2.2 Ensure cross-domain exploration renders dynamic `FUN_EXPLORATION` resources such as Control Odyssey and Ten Drops when present.
- [ ] 2.3 Preserve `/interactive-learning/control-workbench` and `/interactive-learning/multi-representation-linkage` route behavior.

## 3. Validation

- [ ] 3.1 Run targeted unit/source tests for platform role navigation, platform entrypoints, Arena entry UI, and cross-domain exploration catalog behavior.
- [ ] 3.2 Validate with `rtk openspec validate restore-interactive-learning-core-entry --strict`.
