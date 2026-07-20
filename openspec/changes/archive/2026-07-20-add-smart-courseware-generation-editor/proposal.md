## Why

An approved text lesson plan must become editable, directly renderable interactive courseware with executable classroom activities, traceable sources, and safe teacher/student views. This authoring workflow depends on both immutable plan revisions and the fixed slide runtime.

## What Changes

- Generate 6–24 structured courseware steps from an approved plan revision using the P0 allowlist.
- Add executable BOPPPS activities, citations, stable source-gap identities, AI provenance, and role-safe previews.
- Add teacher editing and selected-module-only regeneration with accepted diffs.
- Reuse durable generation jobs and existing response/submission evidence paths.

## Capabilities

### New Capabilities

- `smart-interactive-courseware-authoring`: plan-bound generation, activities, local editing/regeneration, citations, provenance, privacy, and teacher/student previews.

### Modified Capabilities

- None.

## Impact

- Depends on `add-smart-lesson-plan-authoring` and `standardize-generated-courseware-slide-runtime`.
- Adds courseware draft/job persistence, generation schemas, editor UI/API, citation/provenance records, and role-projection tests.
- Does not publish revisions or create classroom sessions.
