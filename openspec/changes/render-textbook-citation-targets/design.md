## Context

Runtime textbook chunks intentionally contain machine-facing markers and retrieval aids. A representative chunk includes `<!-- citation-target: ... -->`, section metadata comments, Markdown image links, and visible `Image description:` blockquotes. Source Pack currently hydrates the chunk href into Konling citation payloads, and the citation panel renders that href directly. The user-facing result is a raw Markdown document instead of a course-quality source reader.

Existing interactive handout pages already render Markdown through React Markdown, GFM, math, KaTeX, and runtime asset resolution. That renderer is close to the needed behavior but is embedded in handout surfaces rather than a reusable citation reader contract.

## Goals / Non-Goals

**Goals:**

- Provide a rendered textbook citation target for Konling and other Source Pack consumers.
- Preserve canonical runtime addresses and citation ids for audit, tests, and raw runtime tooling.
- Hide machine-only comments and image descriptions from human-visible output.
- Render images, formulas, links, headings, lists, tables, and anchors consistently with course handout rendering.
- Add automated and browser evidence for rendered citation pages.

**Non-Goals:**

- Do not alter answer relevance, ranking, or Source Pack candidate selection.
- Do not delete image descriptions from runtime search documents, textbook chunks, or retrieval corpora.
- Do not change `/course-runtime/**` from static raw asset serving to rendered HTML.
- Do not re-author the textbook content corpus in this change.

## Decisions

1. Use a platform-owned rendered reader route instead of changing `/course-runtime/**`.

   `/course-runtime/**` is a static asset boundary used by runtime tooling, tests, and authoring export. Rendering raw Markdown there would create ambiguous content negotiation and could break machine consumers. A separate platform route gives learners a formatted page while keeping raw assets stable.

2. Separate canonical href from display href.

   Source Pack and Konling payloads must retain the canonical runtime href for audit and verification. Student-facing citation anchors should use a rendered display href when the citation target is a textbook chunk, section, or image target. If current types cannot store both values, implementation must extend the citation payload rather than overwriting the canonical address.

   This separation must also preserve answer-relevance audit metadata introduced by the citation relevance governance change. Display-link rendering must not drop relevance basis, pass/fail state, query hash, selected-node or SAR summaries, missing/downgraded citation reasons, limitation state, confidence, freshness, or privacy scope.

3. Extract or share the existing handout Markdown renderer.

   The implementation should reuse the existing handout rendering behavior for Markdown, GFM, math, KaTeX, links, and runtime images. The shared renderer may expose mode-specific policies such as `handout` and `citation`, but it must not duplicate a second ad hoc Markdown renderer for textbook citations.

4. Treat image descriptions as retrieval metadata, not visible learner prose.

   Visible blockquotes or paragraphs beginning with machine image-description markers must be removed from the rendered reader. When useful, the description may be converted to non-visible accessibility metadata for the adjacent image, but it must not display as ordinary text.

5. Make the real Konling click path part of acceptance.

   Unit tests can prove href transformation and renderer preprocessing, but the user-visible failure is the learner clicking a Konling citation. Acceptance must include browser evidence from the real citation chip or citation panel click path showing the rendered reader target, formatted text, loaded images, and absence of raw comments/image-description leakage. Directly opening the reader route may be useful as supplementary debugging evidence, but it cannot satisfy the click-path acceptance gate.

## Risks / Trade-offs

- [Risk] Shared renderer extraction can affect handout rendering. -> Mitigation: preserve existing handout tests or add a focused regression that handout Markdown still renders.
- [Risk] Hiding image descriptions could reduce accessibility if image alt text is empty. -> Mitigation: allow the hidden description to populate alt or accessible description without becoming visible page text.
- [Risk] Display href conversion could lose audit traceability. -> Mitigation: canonical runtime href, citation target id, source id, and rendered display href must all remain available in metadata.
- [Risk] Display href conversion could accidentally promote a relevance-rejected item into a clickable high-confidence citation. -> Mitigation: implementation tests must include fixtures carrying relevance audit metadata and no-relevant-citation states, proving display href generation does not change selection, ranking, omission, or downgrade semantics.
- [Risk] A permissive reader route could become arbitrary file read. -> Mitigation: route resolution must be allowlisted to runtime textbook chunks, sections, and assets, and reject traversal or unsupported extensions.
