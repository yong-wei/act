## Why

Runtime lessons contain hundreds of useful steps and modules, but the current manifests mainly describe presentation and interaction. They do not consistently expose the semantic fields needed to decide whether a step, media asset, knowledge card, or infograph can become a ResourceNode, ResourceSegment, CitationTarget, or PlanningUnit.

The platform needs a projection contract that reads runtime truth without polluting lesson manifests with planner-specific implementation details.

## What Changes

- Define a runtime resource projection sidecar contract for lessons, lesson steps, modules, media, handouts, knowledge cards, and infographs.
- Convert selected runtime resources into audited ResourceNode or ResourceSegment projections.
- Preserve source-of-record boundaries: runtime content remains the content source; projection sidecars own planning and grounding metadata.
- Keep image, infograph, media, and retrieval chunks out of path planning unless an audited ResourceNode creates a PlanningUnit.
- Add validation that missing projection metadata blocks path eligibility while still allowing authoring triage and retrieval where safe.

## Capabilities

### Modified Capabilities

- `resource-node-registry`: consume runtime projection metadata without bypassing ResourceNode audit.
- `resource-segment-scene-binding`: bind runtime media, figures, cards, and lesson fragments to graph nodes and usage scenes.

## Impact

- Affects course-content runtime export, ResourceNode projection builders, knowledge card and infograph manifests, and manifest governance tests.
- Does not perform broad LearningGoal coverage completion; that is handled by `learning-goal-resource-baseline-completion`.
- Does not rewrite interactive lesson visual components or page layout.
- Projection schemas may be implemented before the audit change is archived, but PlanningUnit enablement must wait until `resource-field-completion-audit` missing-field codes, review-state gates, and evidence-contract gates are active.
