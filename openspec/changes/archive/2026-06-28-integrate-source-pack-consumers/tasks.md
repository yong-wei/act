## 1. Authoring Workflows

- [x] Document and wire lesson/homework source-pack usage for large textbooks and references.
- [x] Add local commands or examples that generate compact Markdown plus JSON/audit outputs.
- [x] Add smoke tests or fixture checks for authoring source-pack generation.

## 2. Konling Integration

- [x] Use `konling-answer` Source Packs for query-aware teaching-content citations.
- [x] Preserve citation verification and learner-state limitation behavior.
- [x] Add tests that content citations are still returned when learner personalization evidence is missing.

## 3. Path Planning Integration

- [x] Use `path-planning` Source Packs as supporting evidence for LearningGoal, knowledge, and capability planning queries.
- [x] Keep actual path node selection bound to audited ResourceNode/PlanningUnit eligibility.
- [x] Add tests for evidence support without citation-only path promotion.

## 4. Verification

- [x] Run targeted consumer tests and `openspec validate integrate-source-pack-consumers --strict`.
- [x] Add regression coverage for profile filtering and limitation display/storage.
