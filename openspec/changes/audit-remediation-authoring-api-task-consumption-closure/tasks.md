## Tasks

- [x] 1. Map finding 371 and direct authoring API-consumption residuals to lesson plan, resource, ResourceNode, and knowledge node surfaces.
- [x] 2. Define authoring API task-consumption contracts and task state taxonomy.
- [x] 3. Implement taskized views/actions for covered lesson plan, resource, ResourceNode, and knowledge node data.
- [x] 4. Add status, disabled reasons, save/failure/rollback or non-reversible explanations for covered tasks.
- [x] 5. Add tests for API-backed task grouping, disabled reasons, persistence, failure recovery, rollback/non-reversible states, and audit exclusion of archived flow scope.
- [x] 6. Update audit report and evidence with closure ids and residual gaps.

## Validation

- [x] Run `openspec validate audit-remediation-authoring-api-task-consumption-closure --strict`.
- [x] Run targeted authoring API-consumption tests.
- [x] Attach report diff and representative UI/DOM evidence before marking finding 371 closed.
