## Why

Path planning and Konling citation need resource semantics below the whole-resource level, but path eligibility must still be governed by ResourceNode and PlanningUnit audits. Current resource projections have the right foundation but need segment-aware, scene-aware, graph-aware, citation-aware, and evidence-aware metadata.

## What Changes

- Upgrade ResourceNode, ResourceSemanticProjection, PlanningUnit, CitationTarget, RetrievalChunk, and audits to carry graph and scene binding metadata.
- Add ResourceNode graph profiles that expose graph refs, scene availability, citation readiness, evidence capability, path profile, and governance limitations.
- Support textbook, handout, video, audio, image, and slides segment binding for K/A/Q graph nodes.
- Define a manifest boundary for `yong-wei/videos` without committing to full media import or transcription in this change.
- Preserve the rule that ResourceSegment, RetrievalChunk, and CitationTarget do not become PathNodes unless a ResourceNode/PlanningUnit audit authorizes planning use.

## Capabilities

### New Capabilities

- `resource-segment-scene-binding`: graph-aware resource segment and scene binding for planning and retrieval.

### Modified Capabilities

- `resource-node-registry`: ResourceNode and PlanningUnit audit metadata must include graph, scene, citation, and evidence readiness.
- `learning-evidence-rag-corpus`: retrieval chunks must carry resource projection context without becoming path-plannable nodes.

## Impact

- Affects `src/lib/resource-node-registry.ts`, `src/lib/data-governance/learning-evidence-rag-corpus.ts`, textbook runtime export metadata, and future resource management diagnostics.
- Does not import the full `videos` repository.
- Does not create teacher bulk-edit UI.
