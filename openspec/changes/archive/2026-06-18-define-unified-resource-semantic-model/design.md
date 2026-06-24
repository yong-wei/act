## Overview

This change introduces a semantic contract, not a new content store. Existing systems keep owning their source records. The unified layer records how those records participate in planning, retrieval, citation, rendering, evidence, and governance.

## Model

- `Resource`: a stable semantic identity for an authored or managed learning resource.
- `ResourceSegment`: a stable internal span such as a Markdown block, image, video time range, audio time range, exercise part, or interactive lesson step.
- `CitationTarget`: a resolvable citation address for a segment.
- `RetrievalChunk`: an indexed projection of a segment.
- `PlanningUnit`: a learning action projection that can be considered for adaptive paths.
- `PathNode`: a persisted node inside a learner-specific path round.

`PlanningUnit` must feed or refine ResourceNode semantics. It must not bypass ResourceNode audit, eligibility, privacy, launch target, evidence instrumentation, or path semantics.

## Source Ownership

The semantic layer stores pointers, hashes, mapping metadata, and projection status. It does not duplicate raw lesson content, media transcripts, TeachingResource catalog metadata, simulation internals, Arena hidden evaluation data, or grading raw submissions.

## Compatibility

The first implementation should map existing resources into this model with read-only adapters. Editable governance remains scoped to existing ResourceNode teacher management until a later change explicitly extends editing.

## Risks

- Treating the semantic layer as a new resource database would duplicate content ownership.
- Letting PlanningUnit replace ResourceNode would bypass existing path quality gates.
- Over-modeling before adapters exist would delay downstream RAG and planning work.
