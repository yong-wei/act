## 1. Authoring Workflows

- [ ] Document and wire lesson/homework source-pack usage for large textbooks and references.
- [ ] Add local commands or examples that generate compact Markdown plus JSON/audit outputs.
- [ ] Add smoke tests or fixture checks for authoring source-pack generation.

## 2. Konling Integration

- [ ] Use `konling-answer` Source Packs for query-aware teaching-content citations.
- [ ] Preserve citation verification and learner-state limitation behavior.
- [ ] Add tests that content citations are still returned when learner personalization evidence is missing.

## 3. Path Planning Integration

- [ ] Use `path-planning` Source Packs as supporting evidence for LearningGoal, knowledge, and capability planning queries.
- [ ] Keep actual path node selection bound to audited ResourceNode/PlanningUnit eligibility.
- [ ] Add tests for evidence support without citation-only path promotion.

## 4. Verification

- [ ] Run targeted consumer tests and `openspec validate integrate-source-pack-consumers --strict`.
- [ ] Add regression coverage for profile filtering and limitation display/storage.
