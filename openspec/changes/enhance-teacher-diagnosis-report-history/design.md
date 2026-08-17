## Context

`DiagnosisReport` is a persisted, teacher-authorized snapshot. The API already filters class and student scope and returns only allowlisted fields. This change remains a client-side read projection: it does not change persistence or ask the model for new explanations.

## Decisions

### Source groups fail closed

The current report contract identifies risk flags, competency snapshots, and knowledge-progress records but does not prove assignment or assessment coverage. The projection therefore renders 作业 and 测验 as `未接入`, with both counts `未提供`. It never turns absent data into a count of zero. Existing governed source families appear only as learning-behavior detail labels, never as opaque identifiers.

### Confidence reasons are deterministic

Reasons come from source coverage, known limitation codes, missing knowledge-node attribution, and the current report contract. A recovery action is attached to each reason. Model-generated prose can remain in summary and findings, but cannot create a confidence reason.

### Comparison is structurally constrained

The only comparison candidate is the immediately older entry. It must have the same scope type, scope id, class id, target user, and generator/diagnostic structure version. Stable comparison keys use knowledge-node and risk type, falling back to governed evidence references only when no node exists; titles and summaries never participate. If no stable key exists, the UI says comparison is unavailable.

Severity transitions are the only supported improvement or escalation signal. A disappeared finding is not called an improvement because current report structure cannot distinguish real resolution from omitted model output.

### Existing access and interaction boundaries remain unchanged

History entries remain buttons in a labelled navigation region. Source detail uses native disclosure controls. Selecting, refreshing, and viewing a report remain read-only; recovery wording may advise a later new diagnosis but does not create one.

## Risks and mitigations

- A familiar status icon could be read without context. Every status is now text-labelled and paired with an explanation and recovery action.
- Generated wording could create false historical changes. Comparison ignores wording and refuses mismatched or under-structured entries.
- Summary source labels could leak opaque references. The projection only emits allowlisted source-family labels and tests retain raw-reference omission checks.
