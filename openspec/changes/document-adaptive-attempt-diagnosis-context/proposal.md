## Why

Adaptive-practice answers need a server-verifiable bridge into Konling diagnosis without trusting client-supplied question content or leaking context between conversations. The compatibility boundary for historical answers without immutable snapshots must also be explicit and testable.

## What Changes

- Extend durable adaptive answer snapshots with the question, option explanations, reviewed remediation targets, and controlled misconception tags needed for diagnosis.
- Resolve a requested answer only within the authenticated student and persisted assessment session, including at most three same-session attempts for repeated-misconception detection.
- Bind the diagnosis mode and verified answer reference to the dedicated conversation so other conversations retain their own mode and context.
- Fail closed with an explicit unavailable response when the requested answer or any required historical snapshot is missing, invalid, or outside the authenticated scope.
- Add a student-visible post-answer diagnosis entry while preserving the path-advisor entry and existing conversation history.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adaptive-assessment-persistence`: Define the immutable answer-time question snapshot and historical-data compatibility boundary.
- `konling-agent-runtime`: Define authenticated attempt diagnosis, repeated-misconception context, reviewed remediation grounding, and conversation-level context isolation.
- `adaptive-learning-center-ui`: Define the post-answer diagnosis entry and its coexistence with path advising.

## Impact

Affected areas include adaptive assessment persistence and readers, Konling server context and prompt construction, AI conversation metadata, the adaptive-practice page, and their tests. No database migration or new dependency is introduced.
