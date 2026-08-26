# Change: exclude-unsatisfiable-path-terminals

## Why

Cold-start / `NO_EVIDENCE` learners currently receive control-correction candidates that end on Arena terminals locked by `minimumCompetency` and `minimumEvidenceCount`. Completing the path’s preparation nodes cannot close those gaps, so the route is never fully executable. Issue #1531.

## What Changes

- Official terminal validation is selected only when the current learner can satisfy competency/evidence gates, or when remaining lock reasons are path-closable (`requiredCompletedNodeIds` / `requiredOutcomeRefs`).
- Unsatisfiable terminals stay future/locked work and are not the candidate endpoint.
- If no reachable official terminal exists, return fallback with an explicit limitation instead of an unexecutable closed path.

## Non-goals

- Do not change the #1437 destination contract.
- Do not edit Arena or damping experiment content.
- Do not fabricate completion events or portrait evidence.
- Do not activate production selectors.

## Capabilities

- `adaptive-learning-path-planning`: reject unsatisfiable terminal endpoints for the current learner.

## Impact

- Planner candidate assembly and constraint repair for registered goals that require official terminal validation, especially control-correction cold-start generation.
