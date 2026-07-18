## Why

Evaluators may challenge whether online interactive courseware can be carried into conventional presentation workflows. A secondary slide-proportioned PDF export provides portable evidence without making PPTX or browser-print output the courseware source.

## What Changes

- Add a dedicated student-presentation projection with one 16:9 page per courseware step.
- Export reveal modules in final state and activities as static online-completion prompts without teacher answers.
- Bind exports to immutable courseware revisions and validate page geometry, count, overflow, and role safety.

## Capabilities

### New Capabilities

- `smart-courseware-pdf-export`: revision-bound, student-safe, one-step-per-page 16:9 PDF export.

### Modified Capabilities

- None.

## Impact

- Depends on `publish-smart-courseware-to-classroom` and is P1 rather than a P0 launch blocker.
- Reuses the fixed slide renderer and existing `pdf-lib`; PPTX remains excluded.
