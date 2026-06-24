## Why

Teachers and administrators need to see which resources are ready for knowledge-capability planning and which are missing mappings or evidence instrumentation. Without this audit layer, resources can enter paths or high-confidence assistant answers with incomplete semantic coverage.

## What Changes

- Extend ResourceNode management with read-only audit coverage for knowledge mapping, capability mapping, citation readiness, evidence capability, and path eligibility.
- Keep editable governance scoped to existing permitted ResourceNode fields until later changes explicitly expand editing.
- Exclude resources from high-confidence path planning when required mappings or evidence capability are missing.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `teacher-resource-node-management`: add knowledge-capability mapping audit and read-only gap surfacing.

## Impact

- Affects teacher/admin resource management, readiness summaries, path eligibility diagnostics, and future resource governance workflows.
- Does not alter raw resource content or path execution behavior.
