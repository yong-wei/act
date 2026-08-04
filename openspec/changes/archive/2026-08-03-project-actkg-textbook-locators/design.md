## Context

ActKG's public Bundle can identify source documents and anchors without publishing full textbook text. ACT's role is to bind those stable locators to teaching resources. The three books are a bounded initial inventory; later textbooks require an explicit sidecar and scope decision.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`.

## Goals / Non-Goals

**Goals:**

- Produce deterministic textbook/book/chapter/section resource identities and `EXPLAINS` bindings.
- Preserve exact source IDs, anchor IDs, section/page locators, access mode, and Authority/projection identity.
- Fail closed for the textbook slice when sidecar data is incomplete while keeping other projection slices usable.

**Non-Goals:**

- Do not store, expose, or duplicate unauthorized textbook正文 or exact quotes.
- Do not re-extract engineering entities/relations or judge ActKG provenance correctness.
- Do not turn chapter order into ACT prerequisites or automatically mark textbook sections path-eligible.

## Decisions

### 1. Public locator inputs

The builder consumes ActKG `SourceDocument`, `SourceAnchor`, provenance locator summaries, and a public `source-resource-crosswalk.jsonl` sidecar containing `sourceDocumentId`, `sourceAnchorId`, chapter/section/page locator, and Canonical ID. Every input binds the same Authority release, bundle digest, capture, and projection build.

### 2. Resource hierarchy and IDs

Emit stable `act:textbook:<source-document-id>`, `act:textbook-chapter:<document-id>:<chapter-key>`, and `act:textbook-section:<source-anchor-id>` identities. A section may produce multiple binding rows; a Canonical node may resolve to sections from multiple documents. Section resources default to `REFERENCE_ONLY` unless authoring explicitly records an authorized local/external access mode.

### 3. Sidecar gate

Missing source document, anchor, locator, duplicate identity, unknown Canonical ID, or cross-capture sidecar row marks the textbook slice `REVIEW_REQUIRED` and reports exact rows. It does not block Authority, non-textbook resources, or engineering consumers.

### 4. RAG and path boundaries

RAG/citation may use locator metadata and authorized runtime content through existing source contracts. A locator alone does not grant raw content access or path eligibility; resource registry review and path policy remain separate.

## Risks / Trade-offs

- Locator-only resources may be less useful without an authorized runtime body; this is preferable to copyright or provenance leakage.
- Sidecar maintenance must follow ActKG releases, but Delta impact can scope updates to changed anchors.

## Migration Plan

Validate the three-book sidecar against the v0.12 Authority Snapshot, generate textbook artifacts in staging, then include the slice in Teaching Projection only when all locator checks pass. Keep textbook resources reference-only by default.

## Open Questions

None. The initial book set and access-mode vocabulary are fixed.
