## Why

The existing governed RAG corpus already separates teaching knowledge and learner evidence, but future resources require richer retrieval projection, hybrid search, and knowledge/capability filtering. A standalone resource RAG store would duplicate corpus governance and citation rules.

## What Changes

- Extend `learning-evidence-rag-corpus` with resource retrieval projection semantics.
- Require hybrid retrieval combining scope filters, full-text search, vector search where available, knowledge/capability filters, authority ranking, and reranking.
- Preserve teaching knowledge versus learner evidence separation.
- Add multimedia transcript, image description, exercise, and resource segment indexing expectations.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `learning-evidence-rag-corpus`: add resource retrieval projection and hybrid search requirements.

## Impact

- Affects RAG corpus indexing, retrieval API contracts, citation verification inputs, Konling grounding, recommendations, and grading explanations.
- Does not require generic internet search or retrieval outside registered resources.
