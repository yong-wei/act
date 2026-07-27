# Runtime lesson/media resource semantics closure

Review batches: analysis-design-graph-resource-bindings-2026-07-04, foundation-graph-resource-bindings-2026-07-04, residual-runtime-handout-disposition-review-2026-07-05, residual-runtime-lesson-media-disposition-review-2026-07-05, residual-runtime-lesson-module-disposition-review-2026-07-05, residual-runtime-lesson-step-disposition-review-2026-07-05, runtime-lesson-media-asset-canonical-re-review-2026-07-13, runtime-lesson-planning-unit-review-2026-07-05, runtime-media-handout-disposition-review-2026-07-05, simulation-transfer-graph-resource-bindings-2026-07-04, unit-1-4-knowledge-card-manifest-rereview-2026-07-17, unit-1-4-missing-media-current-manifest-rereview-2026-07-17, unit-1-4-semantic-binding-rereview-2026-07-17, units-1-3-1-5-runtime-structure-review-2026-07-17
Scoped audit/projection rows: 2801
Human-confirmed rows: 2527
Pending re-review rows: 274
Unexplained unreviewed rows: 0
Promoted PlanningUnits: 0 (runtime lesson steps only)
Media/handout/module promotions: 0

## Family counts

- runtime-handout: 39
- runtime-lesson-media: 788
- runtime-lesson-module: 1487
- runtime-lesson-step: 487

## Disposition counts

- embedded-asset: 647
- evidence-producing: 2
- excluded-with-rationale: 1945
- planning-unit: 16
- supporting-citation: 163

## Runtime asset status

- external-http-runtime-asset: 89
- missing-local-runtime-asset: 27
- not-applicable: 2010
- tracked-local-runtime-asset: 647

## Review decision

Each row consumes an explicit item-level decision from the committed review source and is checked against the runtime audit/projection identity. The helper does not infer dispositions, LearningGoal bindings, rationale, reviewer metadata, or independent evidence references.

## Evidence reference syntax

Every `independentEvidenceRef` is `<project-relative-file>#<selector>`. JSON manifests use `json-pointer:/...` and the loader resolves the pointer against the parsed document; Markdown handouts/media indexes use `markdown-line:<positive-line-number>` and the loader checks the non-empty line; only git-index tracked local binary/structured media use `file-sha256:<64-hex-digest>`. A local file present only in the working tree is marked `missing-local-runtime-asset` and uses its real media-index heading line without inventing a file hash. External media is allowed only when the media-index entry contains a real HTTP(S) URL and its URL identity matches the audit source URL; it uses that media-index line and retains the URL identity only as a sha256 digest. Asset status is derived only from the actual git-index state, audit sourcePathOrUrl, and the real media-index URL identity; `runtimeEvidence.assetStatus` and `runtimeEvidence.sourceFilePath` are validated declarations, never classifiers. `assetObservation.workingTreePresent` is retained only as a non-canonical local observation and is excluded from status and decision hashes.

## Formal blockers retained

Starting blocker codes remain visible in each workqueue and review row. They are downstream implementation gaps, not unexplained semantic-review gaps.
