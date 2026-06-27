## Why

The project already has governed runtime projections, `ResourceSegment`, `RetrievalChunk`, `CitationTarget`, textbook search documents, and `LearningEvidenceCorpus` chunks. Source Pack must adapt these governed sources instead of creating a second unmanaged corpus or scanning raw authoring files.

## What Changes

- Adapt governed runtime resource projections and learning evidence chunks into Source Pack candidates.
- Preserve CitationAddress/CitationTarget provenance, resource projection metadata, privacy scope, AI-use permission, review state, content hash, and source version.
- Keep retrieval readiness separate from path eligibility: `RetrievalChunk` and `CitationTarget` can support citations without becoming `PathNode` candidates.
- Add citation hydration and validation paths that resolve display targets from server-owned metadata.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `source-pack-retrieval`: Add governed corpus adapters and citation hydration boundaries.
- `learning-evidence-rag-corpus`: Reuse existing governed corpus chunks as Source Pack candidates without bypassing citation verification.
- `resource-node-registry`: Preserve separation between retrieval/citation readiness and path eligibility.

## Impact

- Proposed modules: `src/lib/source-pack/corpus-adapters.ts`, `citation-hydrator.ts`, `resource-projection-adapter.ts`.
- Existing source inputs: textbook runtime search documents, `LearningEvidenceCorpusChunk`, runtime resource projection sidecars, registered resource node projection metadata.
- Proposed tests: adapter mapping, privacy filtering, citation hydration, path-eligibility separation, unsafe citation rejection.
