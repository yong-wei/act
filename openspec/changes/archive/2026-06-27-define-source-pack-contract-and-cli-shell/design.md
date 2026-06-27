## Design

The Source Pack is a governed evidence package, not a raw search result. It records the caller profile, query context, index/version refs, coverage summary, selected items, limitations, and audit metadata. The CLI is a thin shell around the shared builder so that authoring skills and server runtime consumers use the same contract.

## Contract Shape

The contract should include:

- `packId`, `profile`, `query`, `indexRefs`, `coverage`, `items`, `limitations`, and `audit`.
- `SourcePackItem` references to `resourceNodeId`, `planningUnitId`, `retrievalChunkId`, and `citationTargetId` where available.
- Scoring fields for relevance, graph alignment, authority, eligibility, freshness, and final score.
- Citation payloads hydrated from server-owned metadata in later changes.
- Access metadata for visibility, license, and AI-use permission.

## Boundaries

This change does not implement the real corpus adapters or final ranking algorithm. It establishes the stable contract, serializer, CLI command surface, and fixtures that later changes must honor.

## CLI

The CLI should support at least:

- `build --query --profile --out --format json|markdown|both --top-k`
- `show --citation-target`
- `index status`

Commands may return explicit "not implemented" limitations for adapters or ranking until later changes in this series land, but the output shape must already be valid and testable.
