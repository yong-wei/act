## Why

ACT currently has no formal Teaching Projection contract. Course runtime, lesson steps,教材 resources, core nodes, prerequisites, and knowledge cards therefore cannot be versioned independently from ActKG engineering Authority or activated per consumer.

## Series Dependencies

- Depends on: `revise-actkg-authority-boundary`, `activate-versioned-actkg-engineering-authority`.

## What Changes

- Add an ACT-owned, file-based Teaching Projection authoring/runtime contract built from deterministic manifests.
- Define stable resource IDs for lessons, handouts, interactive steps, textbooks, textbook sections, and cards, plus `COVERS`, `EXPLAINS`, `PRACTICES`, and `ASSESSES` roles.
- Materialize `resources`, `bindings`, `prerequisites`, `core-nodes`, `cards-index`, `projection-manifest`, and `impact-report` artifacts.
- Support authoring `projectionMode` values `REQUIRED`, `OPTIONAL`, and `NONE`; an empty projection is valid.
- Gate only explicit missing/invalid local dependencies and allow consumers to pin independent Authority/Projection combinations.
- Keep authoring as the decision source, runtime as generated read-only output, and avoid a second database or editor.

## Capabilities

### New Capabilities

- `act-teaching-projection`: Versioned ACT-owned resource bindings, core nodes, prerequisites, card index, manifests, and consumer projection combinations.

### Modified Capabilities

None. Existing resource, path, and RAG specs are adapted by later dependent changes once this contract exists.

## Impact

- `course-content/authoring/knowledge/` and `course-content/runtime/knowledge/` projection artifacts and deterministic builders.
- Course/resource registries and future consumer activation manifests.
- No Prisma tables, background editor, upstream ActKG semantic changes, deployment, or historical LearningFact rewrite.
