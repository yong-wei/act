## Why

The first editor simplification removed local helper duplication but left `assignment-editor-workspace.tsx` at 103,947 bytes and explicitly deferred its request and CAS lifecycle. The editor still represents load, dirty, saving, conflict, validation, generation, and publication state across repeated branches.

## What Changes

- Characterize the current load, edit, save, conflict, AI-draft, validation, and publication transitions, including request order, focus recovery, CAS, and idempotency.
- Replace only behavior-equivalent save/publication state representations and repeated response mapping with a smaller explicit local model.
- Remove single-caller helpers, duplicate derived booleans, and redundant effects proven unnecessary by characterization tests.
- Reduce the 103,947-byte workspace implementation to at most 93,552 bytes, counting any production code extracted from it; a generic workspace framework does not qualify.
- Preserve request payloads, immutable published revisions, CAS conflicts, idempotency keys, teacher approval, validation, accessibility, and recovery behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `assignment-editor-workspace-simplification`: add a second-pass requirement for measurable state-machine reduction while retaining Assignment authoring and publication behavior.

## Impact

- Primary code: `src/features/assignment-authoring/assignment-editor-workspace.tsx` and its focused tests; adjacent helpers only when their removal directly reduces the same lifecycle.
- Verification: editor UI/contract tests, revision/CAS/idempotency and AI-draft tests, accessibility checks, typecheck, lint, and before/after metrics.
- No Assignment API, database schema, route, publication policy, AI provider, or UI redesign.
