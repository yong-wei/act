# Design

## Approach

Reuse `evaluateNodeReadiness()`. A terminal is **unreachable** when competency or evidence-count gaps remain and there is no remaining path-closable gate (`requiredCompletedNodeIds` / `requiredOutcomeRefs`). Completing preparation nodes may still unlock completion/outcome gates.

In `toRepairCandidate()`, mark `terminalValidation: 'official'` only for reachable terminals. Unreachable official terminals become ordinary locked, removable nodes so repair can drop them and insert a reachable official terminal, or fail closed with `terminal-validation-resource-missing`.

Do not treat completing preparation resources as proof that Portrait V2 competency/evidence will appear.

## Files

- `src/lib/adaptive-learning-path-planner.ts`
- `src/lib/__tests__/adaptive-learning-path-planner.test.ts`

## Non-goals

Destination routing, Arena content, and fake completion evidence stay out of scope.
