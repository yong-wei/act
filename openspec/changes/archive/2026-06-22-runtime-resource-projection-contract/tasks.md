## 1. Projection Contract

- [x] 1.1 Define sidecar schema for runtime lessons, knowledge cards, and infographs.
- [x] 1.2 Define projection level rules for ResourceNode, ResourceSegment, CitationTarget, RetrievalChunk, and PlanningUnit.
- [x] 1.3 Add source-of-record and version refs for projection sidecars.
- [x] 1.4 Add review audit and evidence-contract fields to path-eligible projection records.

## 2. Builders

- [x] 2.1 Extend ResourceNode registry inputs to consume runtime projection sidecars.
- [x] 2.2 Project lesson steps, handouts, and media without duplicating raw manifest content.
- [x] 2.3 Project knowledge cards as candidate ResourceNodes or segments according to review state.
- [x] 2.4 Project infographs and images as ResourceSegments by default.

## 3. Gates

- [x] 3.1 Block PlanningUnit creation when projection fields are missing or provisional.
- [x] 3.2 Preserve retrieval and citation readiness independently from path eligibility.
- [x] 3.3 Add audit output for projection failures.
- [x] 3.4 Block PlanningUnit creation when evidence contract fields or human-confirmed review audit fields are missing.
- [x] 3.5 Write projection artifacts to `course-content/runtime/resource-governance/runtime-resource-projections.jsonl` and `course-content/runtime/resource-governance/runtime-resource-projection-limitations.json`.

## 4. Verification

- [x] 4.1 Add unit tests for runtime lesson projection sidecars.
- [x] 4.2 Add tests proving module-level segments cannot bypass ResourceNode audit.
- [x] 4.3 Add tests for knowledge card and infograph projection review states.
- [x] 4.4 Run `rtk openspec validate runtime-resource-projection-contract --strict`.
- [x] 4.5 Add schema snapshot tests for runtime projection sidecars.
- [x] 4.6 Add tests proving source hash or version changes stale previously confirmed projection fields.
- [x] 4.7 Verify OpenSpec issue dependency metadata with `/Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/verify-issue-relationships.sh` after issue creation.
