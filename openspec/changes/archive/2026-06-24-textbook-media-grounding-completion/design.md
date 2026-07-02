## Overview

This change turns reviewed textbook sections into citation-ready and, where appropriate, path-ready projections. It also consumes reviewed media projections produced by `ingest-media-source-manifests-for-graph-resources`, without redefining media ingestion.

## Source Scope

The first implementation batch SHALL cover the currently tracked textbook source package `hu-shousong-exercise-analysis-3rd` unless a later proposal adds another explicit source manifest. Media scope is limited to already validated projection outputs from `ingest-media-source-manifests-for-graph-resources`; this change must not ingest raw audio, video, image, or slide files directly.

## Textbook Workflow

Textbook completion should proceed by:

1. Split chapters into section candidates with page anchors and stable ids.
2. Human-confirm section title, page range, knowledge node ids, K/A/Q objective ids, capability targets, and citation policy.
3. Create CitationTargets and RetrievalChunks with content hash and source version.
4. Promote only selected reviewed sections to `textbook_section` PlanningUnits when they also have path profile and evidence policy.

Whole textbook containers remain blocked from path eligibility.

## Media Projection Consumption

Media transcript, image, slide, and infograph semantics enter this change only after the media manifest ingestion pipeline has produced validated ResourceSegment, CitationTarget, RetrievalChunk, and ResourceSemanticProjection records.

Every consumed media projection must declare:

- anchor;
- graph refs;
- scene availability;
- citation policy;
- AI-use permission;
- authority and privacy scope;
- review state.

If the media ingestion output is missing, provisional, or unreviewed, this change may expose a citation/path limitation but must not create a substitute private media parser.

## External And Local Tool Policy

External tools are allowed for media processing only in the upstream media ingestion change. This change may record the tool name, version, input scope, output hash, permission, retention rule, and review decision from that pipeline. Student raw answers, classroom evidence, and learner state SHALL NOT be sent to external tools by default. Textbook and image semantics created by local models remain provisional until a human review record confirms graph and path fields.

## Artifact Paths

The implementation SHALL write grounding artifacts under `course-content/runtime/resource-governance/`:

- `textbook-section-grounding-candidates.jsonl` for reviewed and provisional section candidates;
- `textbook-section-citation-targets.jsonl` for server-owned citation targets and retrieval chunks;
- `textbook-media-grounding-limitations.json` for missing page anchors, missing upstream media projections, provisional review state, unsafe citations, and path promotion blocks.

## Citation Policy

Citation readiness requires a resolvable server-owned address. Model-authored URLs, raw file paths, or unverified captions cannot be displayed as verified citations.

## Path Eligibility

Most textbook sections and media segments are retrieval-only. A section or segment becomes a path resource only when a ResourceNode or PlanningUnit is explicitly reviewed and audited, with complete evidence and review fields from `resource-field-completion-audit`.

## Validation

The system must prove that grounded textbook chunks and consumed reviewed media projections can support Konling citations without automatically becoming path nodes.
