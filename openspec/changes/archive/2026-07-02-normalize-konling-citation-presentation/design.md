## Design

### Current Behavior

Konling final answers can contain four different citation-like signals:

- `konlingCitationGuard` metadata from the runtime.
- Source Pack or CitationChip payloads with server-owned citation addresses.
- Runtime-selected knowledge node and path-execution citation summaries.
- Model-authored Markdown footnotes and generated current-page anchors.

The frontend currently treats the guard limitation as a broad display limitation. As a result, missing learner-state or path-execution context can disable otherwise valid content citations. The renderer also does not consistently strip model-authored footnotes, so duplicate `[1]` links and `#user-content-fn*` anchors can appear as if they were verified platform citations.

### Target Contract

Introduce a normalized `KonlingCitationPresentation` shape derived from server-owned metadata before rendering:

- `items`: ordered, deduplicated citation display items.
- `item.key`: stable type-aware key.
- `item.displayIndex`: display number after deduplication.
- `item.title`: user-facing source title.
- `item.sourceType`: content, knowledge-node, textbook, path-execution, learner-state, simulation, arena, or other governed type.
- `item.confidence`: high, medium, low, or unknown.
- `item.limitation`: citation-level limitation only.
- `item.href`: safe click target when available and permitted.
- `summary.status`: final verified, limited, missing, or unverified status.
- `summary.diagnostics`: development-only diagnostic state that must not control per-citation linkability.

### Linkability

Clickability is decided per citation:

- A citation is clickable when it has a safe server-owned `href`, is not restricted, is not stale, is not missing, and has high or medium confidence.
- A citation is disabled when its own target is missing, restricted, unsafe, stale, provisional, low-confidence, or unavailable.
- Missing personalization evidence may mark the answer as limited, but it must not disable unrelated verified content citations.
- The renderer must never convert model-authored links into verified citation links.

### Deduplication

The normalizer uses type-aware keys:

- Content and Source Pack citations: citation target id, retrieval chunk id, resource node id, or safe href.
- Knowledge node citations: knowledge node id plus source family or safe href.
- Textbook or section citations: book id, section id, anchor, page, figure, or equation ref.
- Path-execution citations: path id, node id, execution id, status, and evidence timestamp where available.
- Learner-state citations: learner-state feature id, evidence ref, source window, and privacy scope.

When stable identifiers are missing, the normalizer may fall back to a conservative key built from source type, title, evidence basis, and safe href. It must not merge citations across different source types only because the titles match.

### Footnote Handling

Model-authored GFM footnotes and generated current-page footnote anchors are not verified citations. The renderer should strip or neutralize them in assistant prose and derive visible numbering only from normalized server-owned citation items.

### Validation

Implementation should add targeted tests for:

- High-confidence content citation remains clickable when personalization context is limited.
- Streaming diagnostic reasons do not force final citation items into global disabled state.
- Duplicate model footnotes are removed or neutralized.
- Duplicate path-execution citations collapse into useful unique entries.
- Citations without safe targets are displayed as limited, not linked.
