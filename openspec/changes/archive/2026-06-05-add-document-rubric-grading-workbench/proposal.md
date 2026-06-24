## Why

The teaching-assistant report identifies PDF and assignment grading as a core closed-loop capability. Existing structured classroom submissions and Arena submissions provide partial scoring evidence, but there is no document ingest, rubric grading, teacher review workbench, annotated feedback, or profile writeback path for PDF reports.

## What Changes

- Add a document conversion and grading pipeline that treats MarkItDown as one conversion adapter for PDF/Office-to-Markdown extraction.
- Define rubric definitions, grading runs, criterion-level evidence, annotations, teacher review states, and profile/evidence writeback.
- Add teacher grading workbench UI and student feedback UI as required product surfaces.

## Capabilities

### New Capabilities

- `document-rubric-grading-workbench`

## Impact

- Adds a new assessment evidence source for the teaching assistant.
- Depends on goal-slice registration for writeback targets and the learning-evidence RAG corpus for citations.
- Does not replace existing `StudentStepResponse`, adaptive practice, or Arena scoring.
