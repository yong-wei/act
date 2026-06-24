## 1. Readiness Metadata

- [x] 1.1 Add readiness metadata fields to governed ResourceNode path semantics and generated checkpoint contracts.
- [x] 1.2 Seed readiness metadata for Arena, advanced simulation, control workbench validation, and terminal validation nodes used by adaptive paths.
- [x] 1.3 Add validation that missing readiness metadata keeps high-complexity nodes out of immediate execution.

## 2. Planner Gates

- [x] 2.1 Evaluate competency, evidence count, completed nodes, and required outcome refs before producing active path nodes.
- [x] 2.2 Return `activeNodeIds`, `lockedNodeIds`, `readinessSummary`, and unlock messages for generated options.
- [x] 2.3 Add a regression fixture for `20230010102601` or an equivalent zero-competency learner proving Arena is not the current node.

## 3. UI Contract

- [x] 3.1 Render locked and preparation states with student-facing language.
- [x] 3.2 Prevent locked nodes from exposing start actions.
- [x] 3.3 Verify student-visible text excludes internal readiness codes and engineering labels.

## 4. Validation

- [x] 4.1 Run targeted planner and ResourceNode tests.
- [x] 4.2 Run browser acceptance for `/assessment/adaptive-practice` locked-node states.
- [x] 4.3 Run `rtk openspec validate govern-adaptive-path-readiness-gates --strict`.
