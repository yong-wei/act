## Context

The platform has Markdown rendering but no reusable rich document editor. Smart lesson drafts and course-basis documents require structured editing, autosave, version-aware persistence, and AI suggestions without exposing their backing JSON.

## Goals / Non-Goals

**Goals:**

- Provide one full-screen visual editor for lesson, course-basis, and smart-courseware documents.
- Preserve domain schemas, immutable revisions, and teacher approval boundaries.
- Support long structured teaching documents with reliable save and recovery.

**Non-Goals:**

- Build a custom editor engine.
- Let AI approval replace teacher approval.
- Change course-basis freeze timing, which belongs to the lifecycle change.

## Decisions

### 1. Wrap one mature editor dependency

Implementation SHALL evaluate maintained React editors against Markdown, tables, formulas, code blocks, accessibility, serialization, and bundle cost, then expose only a project-owned adapter. No second editor is introduced for another preparation document.

### 2. Use one canonical document model per domain

The editor maps lesson content to the existing lesson schema and course-basis content to normalized Markdown. BOPPPS stages are fixed top-level nodes; internal steps are editable ordered children. JSON remains an internal transport.

### 3. Save through optimistic revisions

Autosave and explicit save send the current base revision. Conflicts preserve the local draft and require reload or copy resolution. Exit is blocked or confirmed only while a save is pending or failed.

### 4. Anchor advisory suggestions to content

AI review findings carry a stable block/path anchor, proposed replacement, and status. Accept applies an ordinary teacher edit; ignore records dismissal. Neither action approves the lesson.

## Risks / Trade-offs

- [Editor dependency cannot round-trip formulas or structured stages] → Prove representative round trips before adoption and keep the adapter boundary.
- [Autosave loses concurrent edits] → Use optimistic revisions and server conflict responses.
- [Large documents render slowly] → Virtualize navigation only if measured; do not fragment the saved document.

## Migration Plan

Add the adapter and domain serializers, enable the editor for lesson drafts, then course-basis documents and smart-courseware content. Existing valid documents load through serializers; rollback keeps their persisted canonical content intact.

## Open Questions

None.
