## Why

The platform needs a teacher-facing management entrance for unified resources. ResourceNode registry and audits are not enough unless teachers can browse, classify, inspect warnings, and manage path eligibility within their authorized scope.

## What Changes

- Add teacher ResourceNode management entrance for categorized browse/search.
- Expose mapping warnings, availability, privacy level, teacher policy, evidence instrumentation, and path eligibility.
- Allow scoped single-node edits for policy, availability, display metadata, prerequisites, knowledge mappings, estimated time, cognitive load, and eligibility where permitted.
- Defer bulk import, bulk remapping, automatic metadata repair, and deep analytics to Stage 2.

## Capabilities

### New Capabilities
- `teacher-resource-node-management`: Defines teacher-facing ResourceNode access, warnings, scoped edits, and permission boundaries.

### Modified Capabilities
- None.

## Impact

- Affects teacher resource/admin routes and ResourceNode registry APIs.
- Depends on `register-path-plannable-resource-nodes` and `establish-adaptive-learning-governance-contracts`.
