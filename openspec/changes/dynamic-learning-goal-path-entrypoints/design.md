## Context

The LearningGoal catalog has moved beyond the original two demonstration goals. `listLearningGoals()` currently returns nine `path-ready` goals, and backend APIs such as path-advisor context, path-advisor tools, latest path reads, and Konling runtime checks already use registered-goal validation in several places. The remaining fracture is in the student-facing adaptive path center: page types, goal labels, generation shortcuts, layout tokens, and the path-advisor bridge still encode a two-goal allow-list.

This change closes that gap without creating a second goal system. LearningGoal remains the existing registered goal truth, and the UI receives a projection of that truth.

## Goals / Non-Goals

**Goals:**

- Make `/assessment/adaptive-practice` render its generation entrypoints and goal selector from the registered `path-ready` LearningGoal catalog.
- Remove `controlCorrection*` page-state assumptions where they affect active-goal path recovery, generation, selection, execution, and return URLs.
- Make Konling path-advisor entrypoints and quick prompts follow the same active LearningGoal metadata used by the page.
- Add tests that fail when a new path-ready LearningGoal is missing student-facing text, objective bindings, graph bindings, path policy, entrypoint projection, or Konling context coverage.
- Preserve existing `control-correction` and `frequency-response-foundations` URLs and persisted path compatibility.

**Non-Goals:**

- No new LearningGoal data model, database table, or parallel goal catalog.
- No planner algorithm rewrite.
- No teacher custom-goal authoring UI.
- No broad visual redesign beyond adapting the existing generation and selection surfaces to dynamic goals.

## Decisions

### Use a server-owned LearningGoal option projection

Create a small projection helper, for example `getAdaptivePracticeGoalOptions()`, from `listLearningGoals()`. The projection should include `id`, `title`, `description`, `completionMeaning`, `intentType`, `recommendedPhase`, terminal-validation policy, limitations, default route hrefs, and Konling prompt copy.

Alternative considered: keep a front-end literal array and expand it to nine goals. That would reproduce the current drift problem whenever the backend catalog changes.

### Treat goal ids as dynamic strings validated by the catalog

The page should not keep `AdaptivePracticeGoalId = 'control-correction' | 'frequency-response-foundations'`. It should resolve URL, session storage, latest path, and generated payload goal ids through the catalog projection. Unknown ids should use the existing registered-goal error path or a student-safe fallback state.

Alternative considered: regenerate a TypeScript union from the catalog. That adds build-time complexity without solving runtime catalog drift from configuration changes.

### Rename active page state before widening goal support

State and helpers that govern current path behavior should use names such as `activeGoal`, `activePathPlan`, `activePathRound`, `reloadActiveLearningPath`, and `activeGoalContextHref`. Demo fixtures may still include a goal id, but the variable names should not imply that control correction is the only valid path.

Alternative considered: leave names unchanged while expanding behavior. That would be cheaper initially but would keep hidden maintenance risk when future goals are added.

### Let path-advisor context route provide goal-specific assistant metadata

The client bridge should not precompute mode tokens for a fixed list. The active page should ask `/api/adaptive/path-advisor-context?goal=<id>` for server-owned context, and the route should derive `courseTitle`, topic, objectives, and quick prompts from LearningGoal metadata, falling back only through explicit limitations.

Alternative considered: have layout generate tokens for all goals. That is acceptable as an internal optimization, but the visible behavior must still be driven by the dynamic catalog and registered-goal validation.

## Risks / Trade-offs

- **Risk:** Some older code paths still assume `control-correction` when restoring a path round.  
  **Mitigation:** Add route and unit tests for at least three non-control-correction goals: one foundation goal, one analysis goal, and one terminal-validation goal.

- **Risk:** Dynamic goal display may surface goals whose baseline resources are incomplete.  
  **Mitigation:** Display limitation text from LearningGoal and baseline coverage metadata rather than hiding the goal; planner/tool responses still own blocking states.

- **Risk:** Renaming page state can create noisy diffs.  
  **Mitigation:** Keep the change scoped to adaptive-practice and path-advisor files; do not refactor unrelated learner-state or planner internals.

- **Risk:** Konling prompts may become generic for non-specialized goals.  
  **Mitigation:** Require every path-ready goal to expose enough metadata to build goal-specific course title, topic, learning objectives, and quick questions.

## Migration Plan

1. Add the LearningGoal option projection and catalog completeness tests.
2. Refactor adaptive-practice goal resolution, labels, selector options, storage keys, and generation links to use the projection.
3. Rename active path page state away from `controlCorrection*` where it affects dynamic behavior.
4. Replace fixed path-advisor bridge/token mappings with active-goal server-owned context.
5. Add regression tests covering all nine current LearningGoals and unknown-goal rejection.

Rollback is straightforward: the change is limited to catalog projection and UI/context wiring. Existing persisted paths and goal ids remain unchanged.

## Open Questions

- Whether the goal selector should sort by `recommendedPhase`, intent family, or catalog order. The first implementation should preserve backend catalog order unless product review asks for a different order.
