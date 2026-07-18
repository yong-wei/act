## Why

Registered resources, knowledge cards, and knowledge infographs are high-visibility teaching resources. They are used by the knowledge graph, Konling, and early path explanations, but audit output still shows missing capability targets, path profiles, and review-confirmed semantics across these families.

This batch closes the core registered/knowledge-resource shortfall before larger runtime and long-form batches. It is small enough for implementing agents to review item by item and large enough to remove an obvious platform shortboard.

## What Changes

- Process the remaining helper workqueues for `registered-resource`, `knowledge-card`, and `knowledge-infograph` families.
- For each item, perform agent semantic review against source content, graph node context, LearningGoal K/A/Q objectives, path role, citation target, evidence behavior, privacy policy, and source/version state.
- Classify every item as path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale.
- Preserve before/after helper evidence and residual count; the residual count for this batch must be zero or only blocked by a concrete missing source artifact.

## Impact

- Improves path planning, graph-page Konling grounding, and citation coverage for core knowledge resources.
- Does not use scripts to infer semantic labels; helper scripts may only select workqueues and verify completion.
- Does not block Yang Fan fixture data completion.
