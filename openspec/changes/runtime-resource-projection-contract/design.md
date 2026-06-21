## Overview

This change defines how runtime resources become governed projections. It does not choose every resource for every LearningGoal. It creates the pipeline and contract that later backfills use.

## Projection Sidecars

The preferred output is a lesson-level or collection-level sidecar, for example:

- `course-content/runtime/lessons/<lesson>/resource-projection.json`;
- `course-content/runtime/knowledge/cards/resource-projection.json`;
- `course-content/runtime/knowledge/infographs/resource-projection.json`.

The sidecar references source ids and paths instead of duplicating raw content.

## Projection Levels

Runtime content can project into three levels:

- ResourceNode: executable or visitable resource candidate that may create a PlanningUnit after audit.
- ResourceSegment: bounded content fragment, media clip, image, card section, or lesson fragment for citation and retrieval.
- CitationTarget/RetrievalChunk: grounding artifacts that can be cited or retrieved but cannot become PathNodes.

## Runtime Lesson Rules

Lesson steps may become ResourceNodes only when they have a verified route target, graph binding, ability impact, evidence instrumentation, estimated time, and review state.

Modules inside a step usually become ResourceSegments unless the interaction itself has a distinct launch target and evidence contract.

Handouts and media inherit lesson-level knowledge only when the sidecar confirms the inherited mapping is accurate for that asset.

Every path-eligible projection must declare an evidence contract: event source, event type, client event id policy, attempt key, source log id, dedupe key, timestamps, LearningFact materialization policy, confidence policy, and privacy scope. Projections missing that contract remain retrieval-only or authoring-diagnostic entries.

## Knowledge Card And Infograph Rules

Knowledge cards can become low-load ResourceNodes after human-confirmed graph and capability bindings. Infographs default to ResourceSegments attached to their source knowledge node unless explicitly reviewed as an activity resource.

Prompt extraction and local vision summaries may suggest infograph semantics, but the suggestion is not a high-confidence path field until reviewed.

Human-confirmed projections record reviewer id, role, reviewed time, review batch id, source hash, version ref, generation tool/model and prompt hash where applicable, confidence, and stale invalidation rules.

## Artifact Paths

The implementation SHALL write projection sidecars and diagnostics under `course-content/runtime/resource-governance/`:

- `runtime-resource-projections.jsonl` for reviewed ResourceNode, ResourceSegment, CitationTarget, RetrievalChunk, and PlanningUnit projection candidates;
- `runtime-resource-projection-limitations.json` for missing sidecar fields, stale source hashes, provisional review states, and blocked PlanningUnit reasons.

## Validation

The projection builder must reject path projection when required fields are missing, while still emitting diagnostics useful to the field completion audit.
