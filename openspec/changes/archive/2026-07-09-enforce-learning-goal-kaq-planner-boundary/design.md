## Design Notes

For graph-driven goals, the planner should build an explicit objective boundary from:

- `learningGoal.knowledgeObjectiveIds`
- `learningGoal.capabilityObjectiveIds`
- `learningGoal.qualityObjectiveIds`
- `learningGoal.targetGraphNodeIds`
- expanded goal subgraph prerequisites and allowed related nodes

A ResourceNode may enter the candidate pool only if its reviewed semantic metadata intersects this boundary or if it is a generated checkpoint/remediation node required by the LearningGoal policy. Legacy goal fields may increase or decrease ranking but cannot admit a resource that lacks reviewed LearningGoal, graph, or objective fit.

Diagnostics should include accepted objective refs, rejected objective-mismatch counts, and any low-resource fallback caused by insufficient reviewed coverage.

## Verification Strategy

- Add tests for the nine path-ready LearningGoals.
- Include root-locus and frequency-response regression cases where old compatibility fields could admit unrelated correction/time-domain resources.
- Assert that low-resource fallback states are explicit when K/A/Q coverage is incomplete.
