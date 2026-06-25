## Why

The adaptive path backend now registers nine `path-ready` LearningGoals, but the student path center and Konling entrypoints still expose only `control-correction` and `frequency-response-foundations`. This leaves the platform with a misleading split: the planner can accept more goals, while the visible generation and assistant surfaces remain fixed to two hard-coded targets.

## What Changes

- Replace hard-coded adaptive-practice goal unions, labels, quick links, and Konling bridge mappings with a dynamic LearningGoal catalog projection derived from the registered backend catalog.
- Render the path generation entry, goal selector, goal descriptions, completion meaning, intent, phase, terminal-validation hints, and limitations from LearningGoal metadata for all current path-ready goals.
- Rename page state and helpers that encode `controlCorrection*` semantics into active-goal/path terminology so path recovery, execution, selection, and generation behave correctly when the active LearningGoal changes.
- Make Konling path-advisor context and mode entrypoints follow the active LearningGoal catalog, including server-owned context tokens, LearningGoal-specific quick questions, graph context, and fallback limitations.
- Add catalog completeness tests so adding a new path-ready LearningGoal without required student-facing text, K/A/Q bindings, path policy, goal selector projection, and Konling context fails before implementation can pass.

## Capabilities

### New Capabilities

None. This change connects existing LearningGoal, adaptive path center, and Konling contracts rather than creating a parallel capability.

### Modified Capabilities

- `adaptive-learning-center-ui`: The path center SHALL render goal generation and execution from the registered LearningGoal catalog rather than hard-coded goal ids.
- `konling-agent-runtime`: Konling path-advisor entrypoints SHALL be available for every registered path-ready LearningGoal with server-owned context.
- `learning-goal-packages`: Path-ready LearningGoals SHALL expose enough student-facing and assistant-facing metadata to drive dynamic path entrypoints.

## Impact

- Affected UI: `src/app/assessment/adaptive-practice/page.tsx`, `src/app/assessment/adaptive-practice/layout.tsx`, `src/features/adaptive/path-advisor-entrypoint-bridge.tsx`, and adaptive center tests.
- Affected services/APIs: LearningGoal catalog projection helpers, `/api/adaptive/path-advisor-context`, `/api/adaptive/path-advisor-tool`, `/api/learning-paths/latest`, and Konling path-advisor context assembly where necessary.
- Affected specs: `adaptive-learning-center-ui`, `konling-agent-runtime`, and `learning-goal-packages`.
- No database schema change is expected. Existing persisted paths must remain readable.
