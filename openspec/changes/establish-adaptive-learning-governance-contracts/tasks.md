## 1. Governance Contracts

- [ ] 1.1 Add the prerequisite gate checklist for the seven virtual-simulation-platform-refactor changes.
- [ ] 1.2 Define shared adaptive-learning feature flags and compatibility/rollback expectations.
- [ ] 1.3 Define privacy classification categories for student-visible, teacher-scoped, admin-scoped, audit-only, and system-internal fields.
- [ ] 1.4 Define the shared evaluation-event envelope for learner-state, assessment, ResourceNode, path, Konling, teacher management, and experiment events.
- [ ] 1.5 Document ER/data-dictionary/API-example handoff expectations for downstream changes.

## 2. Validation

- [ ] 2.1 Validate with `rtk proxy openspec validate establish-adaptive-learning-governance-contracts --strict`.
- [ ] 2.2 Confirm downstream split proposals reference this change where they consume shared privacy, evaluation, or rollback contracts.
