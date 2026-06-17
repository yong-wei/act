## 1. Execution Record Contract

- [x] 1.1 Extend path execution/activity records to carry typed complex-node outcome references.
- [x] 1.2 Map adaptive assessment outcomes into path result summaries.
- [x] 1.3 Map simulation, control workbench, and Arena outcomes into path result summaries.

## 2. Advancement Rules

- [x] 2.1 Prevent dependent nodes from becoming current while required result refs are missing.
- [x] 2.2 Re-evaluate readiness when result refs arrive after initial completion.
- [x] 2.3 Preserve skip, return, review, and continued-interaction history during re-evaluation.

## 3. Result UI

- [x] 3.1 Render result cards for adaptive assessment, simulation, control workbench, and Arena nodes.
- [x] 3.2 Render `结果待同步` recovery state for missing bindings.
- [x] 3.3 Include complex-node outcomes in history and evidence review timelines.

## 4. Validation

- [x] 4.1 Add tests for required-result blocking and later unlock.
- [x] 4.2 Add source-specific result-card fixtures.
- [x] 4.3 Capture browser evidence for result cards and missing-result states.
- [x] 4.4 Run `rtk openspec validate complete-adaptive-path-execution-results --strict`.
