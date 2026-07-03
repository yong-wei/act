## Design

The platform should treat "all resources enter path planning" as a governance requirement, not as a requirement that every file, chunk, or figure becomes a visible path node. Each resource must be represented in the planning layer by one of these reviewed dispositions:

- `path-plannable`: may become a PlanningUnit or PathNode after ResourceNode audit passes.
- `supporting-citation`: can be retrieved, cited, and used as evidence for selection rationale, but cannot itself become a PathNode.
- `embedded-asset`: belongs to a parent section, lesson step, slide, exercise, or media segment and inherits planning use through that parent.
- `evidence-producing`: produces learner evidence, assessment evidence, simulation evidence, or Arena context and may affect path state according to an evidence contract.
- `excluded-with-rationale`: intentionally unavailable for path planning because of policy, broken target, duplication, obsolete content, copyright, teacher-only status, or insufficient quality.

## Manual Semantic Boundary

Agents may use SAR and RAG to discover likely graph relations, prerequisite order, and citations. Those outputs remain proposals. Human-reviewed fields are required for:

- knowledge node mappings;
- capability or quality target mappings;
- LearningGoal fit;
- path stage and remediation role;
- prerequisite and successor relations;
- evidence behavior and mastery effect;
- citation and source authority;
- exclusion rationale.

## Helper Contract

The data-completeness helper should remain read-only but must expose disposition gaps by stable id, source family, and follow-up bucket. A resource should not disappear from audit output merely because it is citation-ready or embedded in a parent resource.

## Relationship To Existing Changes

`complete-graph-resource-semantic-coverage` supplies the first semantic completion batch. This change defines the durable contract used by later full-coverage batches.
