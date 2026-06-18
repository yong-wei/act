## Why

Konling and other generated outputs need clickable citations that can resolve to Markdown blocks, images, media timestamps, interaction steps, and external resources. Existing citation chunks expose display hrefs, but the platform needs a stable address and resolver contract so models never invent URLs.

## What Changes

- Add a unified CitationAddress contract for text, image, audio, video, interactive, simulation, Arena, and external resource targets.
- Require citation IDs or span refs to be resolved server-side.
- Extend citation verification to reject missing, stale, unauthorized, or unresolved addresses.
- Preserve existing privacy and authority rules in `learning-evidence-rag-corpus`.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `learning-evidence-rag-corpus`: add address resolution and deep-link validation semantics to citation verification.

## Impact

- Affects citation payloads, citation chips, Konling responses, grading feedback, path rationale, and resource viewers.
- Does not require vector retrieval or new content ingestion by itself.
