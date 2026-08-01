## Why

Issue #1097 shows that changing a student's personalized path-generation configuration can yield the same resource paths and that policy bundles can expose cosmetic variants. Several controls are currently reduced to weak scoring signals or request metadata, so the product claims personalization without proving that the request influenced resource selection.

## What Changes

- Make request-level structured configuration a planning input with explicit precedence over stored preferences, while preserving goal, prerequisite, readiness, terminal-validation, and safety constraints.
- Map supported free-text intent deterministically to existing planning concepts; report unsupported, infeasible, or conflicting intent without silently ignoring it.
- Generate policy-bundle options with sequential avoidance of already selected differentiable learning resources, returning fewer options rather than cosmetic variants when alternatives are unavailable.
- Preserve the requested time budget; report the minimum executable duration when mandatory validation makes the request infeasible instead of silently increasing it.
- Return structured configuration-fulfillment data and render it in student-safe language in the path comparison interface.
- Add regression coverage that proves feasible contrasting configurations change selected differentiable resources or return an explicit unmet reason.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adaptive-learning-path-planning`: Make personalized configuration, distinct option generation, budget handling, and fulfillment evidence contractual planner behavior.
- `adaptive-learning-center-ui`: Present configuration fulfillment and reduced-option limitations in the student path comparison experience.

## Impact

- Planner and policy-bundle assembly in `src/lib/adaptive-learning-path-planner.ts`.
- Konling path-generation request mapping and student-safe result projection in `src/lib/konling-agent-runtime.ts`.
- Adaptive practice comparison request/result mapping in `src/app/assessment/adaptive-practice/page.tsx`.
- Planner unit tests and adaptive path UI/API contract coverage; no database migration or new external dependency.
