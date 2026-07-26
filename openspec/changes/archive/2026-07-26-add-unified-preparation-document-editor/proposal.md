## Why

Smart-preparation documents currently fall back to browser prompts or raw Markdown/JSON, which makes review and revision unsuitable for sustained teaching work. Course-basis documents and generated lesson plans need one governed visual editor rather than separate one-off editing surfaces.

## What Changes

- Add one mature WYSIWYG editing dependency and adapt it behind a project-owned preparation editor.
- Provide a full-screen editor with title and save state at the top, document structure navigation on the left, content editing in the center, and positioned AI review suggestions on the right.
- Support autosave, explicit save, safe exit handling, complete Markdown/table/formula/code rendering, and no raw JSON editing.
- Keep the six BOPPPS stages fixed while allowing internal steps to be added, removed, reordered, and edited.
- Reuse the same editor adapter for editable course-basis documents, lesson-plan drafts, and later smart-courseware content while leaving each domain's structure and publication rules with that domain.
- Allow course-basis edits in place before first actual use; when a version is frozen, editing creates a new version.
- Make AI suggestions advisory and individually acceptable or ignorable; accepting a suggestion changes content but never grants teacher approval.

## Capabilities

### New Capabilities

- `preparation-document-editor`: defines the reusable full-screen editing, persistence, structured navigation, and advisory suggestion contract.

### Modified Capabilities

- `smart-lesson-plan-authoring`: replaces prompt/raw-object editing with governed visual editing while preserving BOPPPS structure and approval semantics.
- `teacher-course-basis-management`: routes editable source documents through the same editor and preserves immutable referenced versions.
- `smart-interactive-courseware-authoring`: requires smart-courseware editing to consume the same editor adapter without moving courseware structure or publication semantics into the shared editor.

## Impact

- Affects smart-preparation and course-basis edit entry points, editor state persistence, document serialization, AI review anchoring, and unsaved-change navigation.
- Introduces one vetted editor dependency; implementation must reuse existing Markdown, GFM, KaTeX, and platform UI primitives where compatible.
- Does not redesign task navigation, course-basis freeze timing, generation retry policy, courseware domain structure, publication semantics, or Konling history.
