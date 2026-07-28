## Why

The existing document grading workbench demonstrates conversion and rubric review, but production submissions still rely on generic JSON storage, synchronous conversion, and a deterministic evaluator. Mathematical homework needs an asynchronous, privacy-aware, anchor-preserving pipeline that produces trustworthy AI grading drafts per assignment question.

## What Changes

- Consume the preceding change's immutable question-bound object assets and normalize both text and document answers into versioned grading evidence.
- Convert each question attachment asynchronously, using Mathpix for formula- or image-heavy work and a governed local fallback such as MarkItDown.
- Preserve rendered pages and canonical Markdown with page, block, span, bounding-box, precision, warning, and converter-version metadata.
- Replace fixed deterministic scoring with a schema-validated AI evaluator adapter that receives only the current question snapshot, reference answer, rubric, and relevant converted answer blocks.
- Add observable, resumable single and batch grading jobs with per-answer failure isolation, explicit rerun identity, deduplication, and provider-policy blocked states.
- Require criterion scores, rationale, confidence, supported evidence anchors, location-aware annotations, and overall comments before a machine draft can enter teacher review.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `document-rubric-grading-workbench`: Consumes the upstream immutable source-asset contract and productionizes AnswerEvidence, Mathpix/local conversion, anchor precision, actual evaluator drafts, batch orchestration, validation, privacy, and retry behavior without selecting, deploying, or redefining a second object-store backend.

## Impact

- Affects answer-evidence and document-grading persistence, background workers, conversion adapters, AI provider runtime, grading APIs, retention/deletion jobs, and operational telemetry; it consumes rather than redefines the upstream object-store adapter.
- Uses Mathpix credentials already configured in the environment only when a versioned external-processing policy permits it; Mathpix and AI evaluator providers share the same failure-closed data-processing gate.
- Binds every grading run to one assignment revision and one question answer from `integrate-mainline-assignment-mission-center`.
- Does not publish scores to students or mutate original uploaded files.
