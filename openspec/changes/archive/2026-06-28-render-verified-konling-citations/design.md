## Design

Konling answers should have two distinct channels:

- Prose channel: model-generated explanation, sanitized for unsafe internal diagnostics and fake citation syntax.
- Citation channel: server-owned metadata from `konlingCitationGuard`, Source Pack items, and CitationChip payloads.

The frontend must render citations from the citation channel. Markdown links inside prose remain ordinary links only when they are safe non-citation links; model-authored GFM footnotes and `#user-content-fn*` anchors must not be shown as verified citations.

## Streaming And Final States

During streaming, development mode may inject diagnostics. The UI should label those as diagnostics, not citations. Once the final message metadata is available, the message should show one of:

- verified citations: clickable CitationChips backed by CitationAddress/CitationTarget.
- limited citations: CitationChips with limitation state, disabled or explanatory click behavior.
- no verified citations: explicit fallback state without fake footnotes.

## Deep Links

Citation clicks should resolve by source type:

- Knowledge node: focus/open the node detail in `/knowledge` or use a server-owned knowledge node route when available.
- Textbook/reference text: open the `course-runtime/resources/.../chunks/...` address.
- Figure/image: open the figure citation address or section anchor.
- Unavailable/restricted/stale citations: show limitation state rather than navigating to a meaningless page anchor.

## Boundaries

This change does not implement Source Pack retrieval ranking. It adapts the presentation layer and runtime message contract so any verified retrieval source can be displayed correctly.
