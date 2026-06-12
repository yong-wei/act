## Why

Unit 1-1 currently exposes development-oriented text in figure areas, lacks a canonical MATLAB code module, and can render generic page interaction status UI on pages that have no learner interaction. These are visible teaching-quality defects and also reveal a gap in the standard interactive module system: code examples are not first-class auditable teaching content.

## What Changes

- Add a canonical `content.code` standard interactive module for source-code examples.
- Render `content.code` with syntax highlighting for MATLAB-style code, not as a generic rich-text block.
- Update authoring guidance so code blocks are modeled as code modules with language, title, explanation, and source payload.
- Update Unit 1-1 so every visible figure/media caption, explanation, and page text uses teaching semantics only; development paths, file paths, platform implementation notes, and generic module labels are removed or replaced.
- Update Unit 1-1 p12 to use MATLAB-form code through the new standard code module.
- Add a repository gate that fails when a non-interactive manifest page renders or requires a generic "page interaction status" module.
- Verify all figure-bearing Unit 1-1 pages for teaching-only visible text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `interactive-module-taxonomy`: add `content.code` as a canonical standard content module with auditable code payload semantics.
- `interactive-course-standard-module-migration`: require code examples in new or migrated interactive courses to use the standard code module and require figure/media visible text to remain teaching-semantic.
- `course-data-quality-gates`: add a strict gate preventing no-interaction pages from rendering generic page interaction status modules.

## Impact

- `src/features/interactive/shared/manifest-runtime/*` content registry and renderer.
- `src/features/interactive/__tests__/*` module taxonomy, registry, and new no-interaction status gate tests.
- `course-content/authoring/lessons/1-1/design/*` and exported `course-content/runtime/lessons/1-1/*`.
- `src/features/interactive/unit-1-1-see-the-full-picture/*` if current implementation needs adapter updates after runtime changes.
- `.agents/skills/interactive-design/*` and `.agents/skills/interactive-lesson/*` guidance so future authoring does not treat code as plain text.
