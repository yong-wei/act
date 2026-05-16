## 1. Preconditions

- [x] 1.1 Confirm `/interactive-learning/control-workbench` exists and renders with `arenaTask` query context.
- [x] 1.2 Confirm the unified workbench consumes the shared `control-workbench/contracts` layer rather than redefining session context.
- [x] 1.3 Confirm backend changes for black-box official evaluation and student/teacher feedback have landed or decide to gate the route switch.

## 2. Routing

- [x] 2.1 Update `getArenaWorkspaceHref` to keep Control Odyssey on `/interactive-learning/control-odyssey`.
- [x] 2.2 Route all other supported Arena tasks to `/interactive-learning/control-workbench`.
- [x] 2.3 Add `preset` derived from task workspace mode while preserving `arenaTask`.
- [x] 2.4 Preserve `publicationId` and extra query params through the helper.
- [x] 2.5 Keep legacy direct routes available without deleting old route components.

## 3. Student Entry Surfaces

- [x] 3.1 Update challenge detail primary action text to `进入控制工作台`.
- [x] 3.2 Update challenge detail explanatory copy to avoid legacy route names as primary entry labels.
- [x] 3.3 Update Arena hall task cards to use unified control-workbench entry language for non-Odyssey tasks.
- [x] 3.4 Preserve allowed methods, recommended preset context, leaderboard summary, and publication badges.

## 4. Tests

- [x] 4.1 Add route-helper tests for white-box, black-box, block-diagram, predictive-control, and Control Odyssey tasks.
- [x] 4.2 Add route-helper tests for `publicationId` and extra query parameter preservation.
- [x] 4.3 Update Arena entry UI tests for the unified primary action label.
- [x] 4.4 Add compatibility coverage for direct legacy multi-representation route access.

## 5. Verification

- [x] 5.1 Run `rtk npm run test:unit -- src/features/arena`.
- [x] 5.2 Run route/page tests that cover `/arena`, challenge detail pages, and `/interactive-learning/control-workbench`.
- [x] 5.3 Run `rtk npm run lint`.
