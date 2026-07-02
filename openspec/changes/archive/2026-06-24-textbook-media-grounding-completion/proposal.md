## Why

Authoring textbooks already contain chapters, OCR/Mathpix output, page ranges, figures, captions, and image assets, but they are not runtime citation-ready or path-ready resources. Media resources already have a separate active ingestion proposal; this change consumes that pipeline output and focuses on reviewed textbook section grounding plus citation/path promotion rules.

Text resources require human-reviewed semantic binding. Media transcript, image, slide, and infograph semantics may be consumed only from `ingest-media-source-manifests-for-graph-resources` output, and remain provisional until reviewed.

## What Changes

- Define and implement textbook section grounding completion.
- Convert textbook chapters into reviewed section candidates with citation addresses, graph bindings, and human-confirmed planning limits.
- Consume validated media segment projections from `ingest-media-source-manifests-for-graph-resources` for citation and path promotion checks.
- Use local model or external-tool output only as provisional metadata unless reviewed, and never expose raw student evidence to external tools by default.
- Make citation readiness independent from path eligibility.

## Capabilities

### Modified Capabilities

- `resource-segment-scene-binding`: complete reviewed textbook section grounding and consume reviewed media projections.
- `learning-evidence-rag-corpus`: index grounded textbook sections and reviewed media projections with verified citation metadata and scope.

## Impact

- Depends on `resource-field-completion-audit`, `runtime-resource-projection-contract`, and `ingest-media-source-manifests-for-graph-resources`.
- Does not own video/audio/image/slides manifest ingestion; that remains in `ingest-media-source-manifests-for-graph-resources`.
- May feed `learning-goal-resource-baseline-completion` after reviewed textbook sections or media projections are path-eligible.
- Does not create mastery-affecting quiz items; that is handled by `kaq-quiz-foundation-bank`.
