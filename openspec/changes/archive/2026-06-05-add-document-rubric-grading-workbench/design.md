## Context

The repository already stores structured student step responses and Arena submissions. The report requires PDF report grading with teacher-in-the-loop review. MarkItDown should be used as a conversion adapter that produces Markdown for analysis; it is not a high-fidelity PDF viewer or the grading engine.

## Goals / Non-Goals

**Goals:**

- Define submission assets, conversion outputs, page/block/span references, rubric definitions, grading runs, annotations, and teacher review states.
- Support MarkItDown-based PDF/Office conversion while allowing fallback or supplemental extractors for page mapping.
- Build teacher grading workbench UI with upload queue, conversion status, PDF/Markdown preview, rubric tree, AI draft, and teacher edit controls.
- Build student feedback UI with annotated document, rubric breakdown, evidence links, and profile impact summary.
- Map approved criterion results into governed evidence and registered goal dimensions.

**Non-Goals:**

- Fully automated final grading without teacher approval.
- Pixel-perfect PDF reconstruction in the first implementation.
- Replacing platform-native structured assignment evidence.

## Decisions

### Decision 1: MarkItDown is a converter adapter

MarkItDown produces Markdown and structure candidates for LLM analysis. Page mapping, preview rendering, annotation writing, and teacher review remain platform responsibilities.

### Decision 2: Human review gates writeback

Machine grading drafts may inform teachers, but profile writeback and returned feedback require an approved or teacher-edited grading run.

### Decision 3: UI is part of the capability

The change is incomplete if it only adds APIs or worker jobs. Teacher and student surfaces must be demonstrable.

## Validation

- Worker tests SHALL cover successful conversion, conversion failure, idempotent retry, and missing page mapping fallback.
- API/UI tests SHALL cover teacher review, criterion edit, approval, returned feedback, and unauthorized access.
- Evidence tests SHALL prove approved criterion results write back to governed evidence with confidence and rubric version.
- `rtk openspec validate add-document-rubric-grading-workbench --strict` SHALL pass.
