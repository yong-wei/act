## 1. Governance Contracts

- [x] 1.1 Add the prerequisite gate checklist for the seven virtual-simulation-platform-refactor changes.
- [x] 1.2 Define shared adaptive-learning feature flags and compatibility/rollback expectations.
- [x] 1.3 Define privacy classification categories for student-visible, teacher-scoped, admin-scoped, audit-only, and system-internal fields.
- [x] 1.4 Define the shared evaluation-event envelope for learner-state, assessment, ResourceNode, path, Konling, teacher management, and experiment events.
- [x] 1.5 Document ER/data-dictionary/API-example handoff expectations for downstream changes.

## 2. Validation

- [x] 2.1 Validate with `rtk proxy openspec validate establish-adaptive-learning-governance-contracts --strict`.
- [x] 2.2 Confirm downstream split proposals reference this change where they consume shared privacy, evaluation, or rollback contracts.
