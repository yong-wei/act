## Why

ACT needs textbook resources in the Teaching Projection, but it must not copy or re-review protected textbook content. ActKG already publishes SourceDocument, SourceAnchor, and provenance locator metadata for the three source textbooks; ACT should project those public locators as reference resources.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`.

## What Changes

- Build stable `TEXTBOOK` → `CHAPTER` → `SECTION` resources for the three ActKG source textbooks.
- Use public SourceDocument/SourceAnchor/provenance locator and `source-resource-crosswalk` metadata to create `EXPLAINS` bindings.
- Preserve reference-only, local-authorized, or external-authorized access modes without copying unauthorized正文.
- Allow one section to explain multiple Canonical IDs and one Canonical ID to have sections in multiple books.
- Treat missing/invalid locator sidecar as a textbook-projection failure only; it does not invalidate Authority or other Teaching Projection resources.

## Capabilities

### New Capabilities

None. This extends existing reviewed textbook and RAG resource contracts.

### Modified Capabilities

- `resource-node-registry`: textbook resources are identified from ActKG public locators at section grain and remain reference-governed.
- `resource-segment-scene-binding`: public SourceAnchor locators bind textbook sections to Canonical nodes without implying path eligibility.
- `learning-evidence-rag-corpus`: projected textbook resources carry authority, locator, and citation-safe provenance.

## Impact

- Textbook authoring sidecars, resource registry inputs, projection bindings, and RAG citation metadata.
- No textbook正文 copy, new database table, upstream semantic review, or remote deployment.
