## Why

`assignment-editor-workspace.tsx` is a large stateful editor with repeated
question, rubric, asset, validation, and save-state branches.  Its current
control flow makes draft-versus-published revision rules and teacher-directed
AI authoring hard to audit, even though the Assignment API already owns those
semantics.

## What Changes

- Apply the `code-simplification` workflow to the existing editor after C15,
  reducing duplicated state transitions, nested conditions, and unclear
  intermediate values.
- Simplify draft load/save/conflict handling, question selection, rubric and
  asset updates, and publication-state rendering without changing behavior.
- Preserve immutable published revisions, content snapshots, version/CAS and
  idempotency handling, server-derived audiences, validation gates, and
  teacher approval of AI-generated drafts.
- Record actual before/after complexity, behavior, accessibility, and test
  evidence; splitting the TSX file alone is insufficient.

## Capabilities

### New Capabilities

- `assignment-editor-workspace-simplification`: Defines the behavior-preserving
  simplification and evidence contract for teacher authoring.

### Modified Capabilities

None.  `assignment-lifecycle-public-api` and
`assignment-authoring-and-publication` remain authoritative; this change does
not alter their requirements.

## Impact

- Primarily affects `src/features/assignment-authoring/assignment-editor-
  workspace.tsx`, its UI contracts and focused tests, with adjacent helpers
  only where a measured duplication is removed.
- Depends on `complete-assignment-lifecycle-owner-consolidation` (C15).
- No database schema, Assignment API, revision/snapshot identity, AI provider,
  Learning Record, Assessment, route, or publication policy changes.
