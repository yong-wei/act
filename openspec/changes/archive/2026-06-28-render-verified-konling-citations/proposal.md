## Why

After Source Pack retrieval is introduced, Konling still needs a separate presentation contract. The current chat renderer treats model-authored GitHub-flavored Markdown footnotes as ordinary links, which can display duplicate `[1]` references and route users to `/knowledge#user-content-*` anchors instead of verified platform citations. This creates a false citation appearance even when the server citation guard still marks the streaming answer as unverified.

## What Changes

- Render Konling citations from server-owned `konlingCitationGuard` metadata, Source Pack items, and CitationChip payloads rather than from model-authored Markdown footnotes.
- Strip, disable, or normalize model-authored GFM footnotes and `#user-content-fn*` anchors in assistant-visible content.
- Add a final citation presentation state that replaces or supplements streaming diagnostics once the answer is complete and citation verification has run.
- Route citation clicks through platform-owned CitationAddress/CitationTarget handling for knowledge nodes, textbook/reference chunks, figures, and unavailable citations.
- Preserve development diagnostics without exposing them as user-facing citation links.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-agent-runtime`: Konling citation output must separate model prose from verified citation metadata and expose a completion-state presentation contract.
- `source-pack-retrieval`: Source Pack consumer integration must include verified citation rendering and deep-link behavior, not only retrieval.

## Impact

- Frontend rendering: `AIMessageContent`, global Konling/sidebar message bubbles, citation chip/list component.
- Runtime metadata: `konlingCitationGuard` message metadata, streaming/final citation guard state, Source Pack citation payloads.
- Tests: Markdown footnote sanitization, CitationChip rendering, citation click targets, streaming-to-final transition, and no fake citation anchors.
