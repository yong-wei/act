## Why

The platform already has governed snapshots, feature cache, teacher insights, and a future control-correction report, but the teaching-assistant report requires visible, role-specific diagnosis that explains judgments, root causes, next actions, and supporting evidence. Without a materialized diagnosis layer, pages and Konling modes will keep rephrasing raw metrics inconsistently.

## What Changes

- Add a role-based diagnosis contract for student, teacher, and service consumers.
- Materialize diagnosis cards from registered goal slices, governed evidence, path records, assignment/grading signals where available, and class aggregates.
- Require every diagnosis claim to expose evidence references, confidence limits, next-action links, and role-appropriate privacy redaction.

## Capabilities

### New Capabilities

- `role-based-learning-diagnosis`

## Impact

- Provides the shared narrative layer for student overview, teacher consultation, prep packs, grading writeback, and Konling modes.
- Consumes future path evidence and teacher-report metrics when available.
- Does not implement path strategy selection, grading, or prep-pack generation.
