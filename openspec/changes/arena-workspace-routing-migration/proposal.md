## Why

After unified workbench presets exist, Arena challenge entry should stop routing students to unrelated pages for design and submission. Routing migration should be a separate final step so earlier presets can be verified before becoming default.

## What Changes

- Change Arena workspace links to target `/interactive-learning/control-workbench` with a preset parameter.
- Preserve `arenaTask` and `publicationId` parameters.
- Route multi-representation, composite, black-box, and predictive tasks to their unified presets.
- Keep Control Odyssey on its dedicated route until the Odyssey bridge change is applied.
- Update challenge detail entry wording to refer to the unified control workbench.

## Capabilities

### New Capabilities
- `arena-workspace-routing-migration`: Defines when and how Arena challenge entry links migrate to unified control workbench presets.

### Modified Capabilities

## Impact

- Touches `src/features/arena/workspace-routing.ts` and challenge-detail UI text/tests.
- Depends on the shell and relevant presets being implemented first.
- No evaluator, database, or submission API changes.
