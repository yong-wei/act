## 1. Projection Contract

- [ ] 1.1 Define sidecar schema for runtime lessons, knowledge cards, and infographs.
- [ ] 1.2 Define projection level rules for ResourceNode, ResourceSegment, CitationTarget, RetrievalChunk, and PlanningUnit.
- [ ] 1.3 Add source-of-record and version refs for projection sidecars.
- [ ] 1.4 Add review audit and evidence-contract fields to path-eligible projection records.

## 2. Builders

- [ ] 2.1 Extend ResourceNode registry inputs to consume runtime projection sidecars.
- [ ] 2.2 Project lesson steps, handouts, and media without duplicating raw manifest content.
- [ ] 2.3 Project knowledge cards as candidate ResourceNodes or segments according to review state.
- [ ] 2.4 Project infographs and images as ResourceSegments by default.

## 3. Gates

- [ ] 3.1 Block PlanningUnit creation when projection fields are missing or provisional.
- [ ] 3.2 Preserve retrieval and citation readiness independently from path eligibility.
- [ ] 3.3 Add audit output for projection failures.
- [ ] 3.4 Block PlanningUnit creation when evidence contract fields or human-confirmed review audit fields are missing.
- [ ] 3.5 Write projection artifacts to `course-content/runtime/resource-governance/runtime-resource-projections.jsonl` and `course-content/runtime/resource-governance/runtime-resource-projection-limitations.json`.

## 4. Verification

- [ ] 4.1 Add unit tests for runtime lesson projection sidecars.
- [ ] 4.2 Add tests proving module-level segments cannot bypass ResourceNode audit.
- [ ] 4.3 Add tests for knowledge card and infograph projection review states.
- [ ] 4.4 Run `rtk openspec validate runtime-resource-projection-contract --strict`.
- [ ] 4.5 Add schema snapshot tests for runtime projection sidecars.
- [ ] 4.6 Add tests proving source hash or version changes stale previously confirmed projection fields.
- [ ] 4.7 Verify OpenSpec issue dependency metadata with `/Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/verify-issue-relationships.sh` after issue creation.
