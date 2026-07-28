## Why

Course-basis sources can be created but not safely managed: disabled documents become unreadable, reference blockers are opaque, extraction output is fragmented, and current confirmation semantics freeze documents too early. Teachers need a transparent document lifecycle that preserves history without preventing normal correction before actual use.

## What Changes

- Render each source as one continuous structured document with Chinese lifecycle labels and retained historical access.
- Permit hard deletion of unreferenced course bases and document versions.
- Refuse destructive deletion after a document version is referenced, while keeping it clickable and showing the blocking task, revision, or courseware references plus a concrete action.
- Allow disabling referenced sources without hiding their historical content.
- Keep a submitted document editable until a smart-preparation resource pack first adopts its content; selection alone does not freeze it.
- Atomically confirm and freeze the version only when a recalled candidate is accepted as evidence for knowledge points, goals, a preparation resource pack, or generation context.
- Create a new version for later edits to frozen content and retain stable anchors, hashes, citations, and history.
- Localize source status as `上传中`, `正在提取`, `可编辑`, `已冻结`, `已停用`, or `处理失败`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `teacher-course-basis-management`: changes confirmation from an import-time manual gate to first-use atomic freeze, adds complete rendered-document presentation, deletion and disable semantics, and actionable reference blockers.

## Impact

- Affects course-basis and document APIs, extraction projections, reference checks, version transitions, retrieval eligibility, and historical views.
- Supersedes the confirm-on-import behavior only where first-use freeze now governs mutable submitted content.
- Depends on `add-unified-preparation-document-editor` for the final editing surface.
