## Why

Konling and RAG currently have graph, course, textbook, and card inputs but no single versioned combination describing which Authority and Teaching Projection they use. This permits engineering and teaching evidence to be mixed implicitly and cannot distinguish a missing optional card from a missing Canonical node.

## Series Dependencies

- Depends on: `activate-versioned-actkg-engineering-authority`, `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`, `project-actkg-textbook-locators`, `migrate-knowledge-cards-to-canonical`.

## What Changes

- Add Authority/Projection/current Canonical/resource/prerequisite/card fields to the server-owned Konling context.
- Split Engineering RAG from Teaching Resource RAG while allowing an explicit, provenance-preserving composition.
- Use scoped projected resources and textbook locators/cards without writing ACT teaching edges back to ActKG.
- Keep graph context server-owned, role-scoped, citation-safe, and compatible with Legacy/pinned fallback.
- Make missing/invalid projection state explicit and fail closed rather than allowing model inference.

## Capabilities

### New Capabilities

None. Existing Konling context and governed RAG contracts are extended.

### Modified Capabilities

- `konling-agent-runtime`: context and tool outputs carry explicit Authority/Projection/resource/prerequisite/card provenance.
- `konling-kaq-graph-context`: graph context includes scoped teaching projection without evidence writeback or authority mixing.
- `learning-evidence-rag-corpus`: Engineering and Teaching Resource RAG domains compose explicitly and retain distinct authority.

## Impact

- Konling server context/tool schemas, graph-context resolver, RAG retrieval composition and citations.
- No new model, upstream ActKG mutation, path behavior, database schema, deployment, or user-visible implementation detail.
