## 1. Semantic Contract

- [ ] 1.1 Define TypeScript contracts for Resource, ResourceSegment, CitationTarget, RetrievalChunk, and PlanningUnit.
- [ ] 1.2 Add mapping documentation that identifies source-of-record ownership for runtime lesson media, TeachingResource, knowledge cards, simulations, Arena tasks, and grading artifacts.
- [ ] 1.3 Add validation rules proving semantic resources do not copy raw content or teacher-owned metadata.

## 2. ResourceNode Integration

- [ ] 2.1 Map PlanningUnit fields into ResourceNode planning metadata where path eligibility is needed.
- [ ] 2.2 Preserve ResourceNode audit, launch target, privacy, evidence instrumentation, and path semantics as the path-planning gate.
- [ ] 2.3 Add tests for resources with multiple source refs and incomplete launch/citation targets.

## 3. Verification

- [ ] 3.1 Run targeted unit tests for resource-node registry mapping.
- [ ] 3.2 Run `openspec validate define-unified-resource-semantic-model --strict`.
