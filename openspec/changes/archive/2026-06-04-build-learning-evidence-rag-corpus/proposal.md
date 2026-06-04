## Why

The future cited Konling path-coaching change will require citations for control-correction coaching, but the teaching-assistant report needs citations across diagnosis, recommendations, grading, feedback, teacher reports, and prep packs. Those surfaces need a shared learning-evidence RAG corpus instead of page-specific retrieval.

## What Changes

- Define a governed corpus and citation protocol for course content, knowledge cards, runtime handouts, diagnosis materializations, path evidence summaries, grading artifacts, simulation/Arena summaries, and teacher reports.
- Add retrieval and citation-verification contracts that can be used by Konling, diagnosis rendering, grading, recommendations, and prep-pack generation.
- Require citation validation to reject fake chunk ids, inaccessible sources, privacy violations, and unsupported source types.

## Capabilities

### New Capabilities

- `learning-evidence-rag-corpus`

## Impact

- Extends the future control-correction citation baseline into a reusable course-wide evidence layer.
- Does not implement model provider compatibility, which remains covered by `add-model-provider-compatibility-matrix`.
- Does not build the grading workbench, but provides citation and corpus primitives for it.
