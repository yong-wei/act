# Design

## Approach

Reuse `evaluateNodeReadiness()`. A terminal stays official when remaining locks include `requiredCompletedNodeIds` or `requiredOutcomeRefs` that later path nodes can close. If the only remaining locks are `minimumCompetency` / `minimumEvidenceCount`, it is not official: those gaps are not produced by completing preparation resources. Locked terminals with path-closable gates remain future work per existing path-option readiness structure.

In `toRepairCandidate()`, mark `terminalValidation: 'official'` only for reachable terminals. Unreachable official terminals become ordinary locked, removable nodes so repair can drop them and insert a reachable official terminal, or fail closed with `terminal-validation-resource-missing`.

Do not treat completing preparation resources as proof that Portrait V2 competency/evidence will appear.

## Files

- `src/lib/adaptive-learning-path-planner.ts`
- `src/lib/__tests__/adaptive-learning-path-planner.test.ts`

## Non-goals

Destination routing, Arena content, and fake completion evidence stay out of scope.
