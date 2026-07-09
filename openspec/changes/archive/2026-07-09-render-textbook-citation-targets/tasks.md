## 1. Contract And Routing

- [x] 1.1 Define the rendered textbook citation target URL contract for chunks, sections, and image/figure anchors.
- [x] 1.2 Extend Source Pack/Konling citation metadata so canonical runtime href, student-facing rendered display href, answer-relevance audit metadata, limitation state, confidence, freshness, and privacy scope are all preserved.
- [x] 1.3 Keep `/course-runtime/**` raw asset behavior unchanged and covered by regression tests.

## 2. Shared Markdown Rendering

- [x] 2.1 Extract or introduce a shared runtime Markdown renderer reused by interactive handouts and textbook citation pages.
- [x] 2.2 Add citation-reader preprocessing that hides source comments and machine-only image descriptions from visible output.
- [x] 2.3 Resolve runtime textbook image links to real image elements and preserve formulas/tables/link rendering.

## 3. Konling Citation Integration

- [x] 3.1 Route textbook Source Pack citations in Konling presentation to rendered display hrefs.
- [x] 3.2 Preserve canonical citation metadata for audit, verification, and unavailable-state handling.
- [x] 3.3 Ensure image-containing textbook chunks open to rendered pages with visible images and no raw Markdown syntax.

## 4. Validation And Review

- [x] 4.1 Add unit tests for href transformation, canonical href retention, relevance audit retention, no-relevant-citation downgrade retention, raw route preservation, and image-description hiding.
- [x] 4.2 Add focused tests for Konling citation presentation using a textbook chunk citation carrying canonical href, display href, citation target/source ids, confidence, freshness, limitation state, privacy scope, and answer-relevance audit metadata.
- [x] 4.3 Capture browser evidence for the real Konling textbook citation chip or citation panel click path at desktop and 320px mobile widths, in light and dark themes where supported, proving the target page renders loaded images and no raw corpus leakage.
- [x] 4.4 Run relevance regression coverage for Source Pack and Konling so display href generation does not change `konling-answer` selection, ranking, omitted citation, or no-relevant-citation downgrade semantics.
- [x] 4.5 Run OpenSpec validation, issue-body validation, focused unit tests, typecheck, and independent review.
