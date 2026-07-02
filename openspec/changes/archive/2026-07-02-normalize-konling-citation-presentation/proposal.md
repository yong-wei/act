## Why

Konling currently mixes streaming citation diagnostics, final citation guard state, model-authored Markdown footnotes, and rendered citation links too late in the frontend. This creates several visible failures: duplicate `[1]` footnotes in prose, `#user-content-fn*` anchors that navigate to the current knowledge page instead of a citation target, high-confidence content citations being globally downgraded because personalization evidence is missing, and repeated path-execution entries with no useful click target.

The platform already has server-owned citation metadata and Source Pack citation contracts. The missing layer is a normalized CitationPresentation contract that turns raw guard metadata, Source Pack citations, knowledge node citations, and path evidence citations into a deterministic, deduplicated, per-citation display model before any chat UI renders it.

## What Changes

- Add a normalized Konling citation presentation contract for final assistant messages.
- Separate streaming diagnostics from final citation presentation so development notices cannot globally downgrade verified content citations.
- Deduplicate citations by type-aware keys before display.
- Restore per-citation clickability for high-confidence or medium-confidence citations with safe server-owned targets.
- Disable only citations that individually lack a safe target, are restricted, stale, missing, or low-confidence.
- Suppress or neutralize model-authored Markdown footnotes so verified citation numbering comes only from normalized metadata.
- Add tests for duplicated footnotes, streaming-diagnostic separation, per-citation link restoration, and citation deduplication.

## Impact

- Extends `konling-agent-runtime`.
- Touches citation metadata normalization, citation presentation components, and focused tests.
- Does not hand-author missing semantic resource fields or learner/path diagnostic data.
- Enables later unified Konling chat UI work to consume one citation presentation model instead of re-implementing link and limitation rules.
