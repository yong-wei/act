## Tasks

- [ ] 1. Run helper and define the full in-scope core-resource completion set.
  - Include all helper-discovered registered TeachingResources, runtime lessons, knowledge cards, infographs, simulations, control workbench entries, Arena preview/terminal-validation resources, quizzes, exercises, and existing platform-managed practice resources.

- [ ] 2. Manually complete semantic mappings.
  - Fill knowledge node refs, capability/quality refs, LearningGoal refs, prerequisite/successor relations, path stage, remediation role, and review metadata.

- [ ] 3. Complete route and evidence readiness.
  - Fill route targets, evidence contracts, evidence instrumentation, privacy policy, teacher policy, source hash, and readiness metadata.

- [ ] 4. Regenerate governance artifacts and rerun helper.
  - Verify all in-scope core-resource findings are resolved, classified, or reviewed as limitation/exclusion.
  - Preserve before/after denominator counts by resource family, unaccounted counts, invalid promotion counts, unreviewed semantic counts, and remaining blocker counts.

- [ ] 5. Add path planning and Konling checks for core resources.
  - Verify generated paths can select more than one core resource type for registered LearningGoals.
  - Verify Konling can cite resources used or recommended by generated paths.

- [ ] 6. Validate the change.
  - Run `rtk openspec validate complete-core-teaching-resource-path-readiness --strict`.
  - Run helper, targeted path planner tests, and targeted citation tests.
