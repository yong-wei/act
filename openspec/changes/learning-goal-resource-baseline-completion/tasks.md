## 1. Baseline Matrix

- [ ] 1.1 Build the path-ready LearningGoal x resource-type baseline matrix.
- [ ] 1.2 Select the minimal baseline resource set from registered resources, runtime steps, knowledge cards, infographs, handouts, and existing quiz candidates.
- [ ] 1.3 Record missing categories for goals that cannot yet meet baseline coverage.
- [ ] 1.4 Lock the first implementation batch to the in-scope path-ready LearningGoal ids and emit limitations rather than expanding scope when a goal lacks resources.

## 2. Large-Scale Field Completion

- [ ] 2.1 Human-confirm LearningGoal, K/A/Q objective, knowledge node, capability target, and quality target bindings for selected baseline resources.
- [ ] 2.2 Complete path profile, evidence instrumentation, estimated time, cognitive load, and source refs for selected baseline resources.
- [ ] 2.3 Complete readiness metadata for high-complexity baseline resources.
- [ ] 2.4 Preserve generated or local-model suggestions as provisional until reviewed.
- [ ] 2.5 Complete evidence contracts and human-review audit fields before any selected resource becomes path-eligible or mastery-affecting.

## 3. Coverage And Planner Integration

- [ ] 3.1 Materialize ResourceCoverage overlay by LearningGoal and K/A/Q objective.
- [ ] 3.2 Feed only human-confirmed baseline resources into graph-driven planner inputs.
- [ ] 3.3 Return low-resource limitations when baseline categories are missing.
- [ ] 3.4 Ensure locked heavy nodes expose fallback resources instead of becoming current executable nodes.
- [ ] 3.5 Include denominator, source window, artifact versions, and limitation reasons in baseline coverage payloads.
- [ ] 3.6 Write baseline artifacts to `course-content/runtime/resource-governance/learning-goal-resource-baseline-matrix.json`, `learning-goal-resource-baseline-limitations.json`, and `learning-goal-resource-baseline-reviewed-bindings.jsonl`.

## 4. Verification

- [ ] 4.1 Add coverage tests for every current path-ready LearningGoal.
- [ ] 4.2 Add readiness tests for low-competency learners and high-complexity nodes.
- [ ] 4.3 Add planner tests proving paths use baseline coverage rather than fixed two-goal branches.
- [ ] 4.4 Run `rtk openspec validate learning-goal-resource-baseline-completion --strict`.
- [ ] 4.5 Add tests for the fixed first-batch LearningGoal ids and baseline limitation payloads.
- [ ] 4.6 Add tests proving baseline completion does not use provisional resources as path-eligible coverage.
- [ ] 4.7 Run focused adaptive path planner tests covering graph-driven goal coverage and readiness.
- [ ] 4.8 Verify OpenSpec issue dependency metadata with `/Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/verify-issue-relationships.sh` after issue creation.
