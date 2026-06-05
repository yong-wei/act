## Why

The report says the project has an adaptive-center contract but not a real student-facing control-correction learning center. Existing adaptive entry points can still behave like scattered features. Students need one entry that shows their correction competency state, why the path was recommended, what to do next, what evidence has been recorded, and how to recover from empty or low-evidence states.

## What Changes

- Specialize the adaptive learning center for `goal=control-correction`.
- Add route and contract behavior for competency hero, path map, next action, readiness gate, evidence timeline, citation drawer, and Konling dock.
- Preserve route intent from homepage, profile, cockpit, adaptive practice, and contextual recommendations.
- Require non-blank loading, empty, evidence-limited, and feature-flag fallback states.

## Capabilities

### Modified Capabilities

- `adaptive-learning-center-ui`

## Impact

- Creates the student-facing control-correction product surface.
- Does not implement the underlying path persistence or evidence cache, which are upstream dependencies.
- Requires browser or Playwright validation for entry routes and empty-state behavior during implementation.
