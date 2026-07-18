## Why

Konling textbook citations currently navigate to raw runtime Markdown chunks such as `/course-runtime/resources/textbooks/.../chunks/ch01-advanced-problems-031__chunk-001.md`. Those targets are correct as machine-readable runtime assets, but they are not acceptable human reading pages: learners see source comments, Markdown syntax, image URLs, and machine-oriented image descriptions that exist only to improve retrieval.

The related active change `govern-konling-answer-citation-relevance` fixes whether a citation is relevant. This change fixes what happens after a valid textbook citation is clicked.

## What Changes

- Add a rendered textbook citation reader that uses the same Markdown rendering family as interactive course handouts, extended where needed for textbook chunks, sections, formulas, tables, anchors, and images.
- Route Konling/Source Pack textbook citation click targets to the rendered reader while preserving canonical runtime citation addresses for audit, verification, and raw asset serving.
- Render image-containing chunks as formatted text plus real images; hide machine-only image descriptions from visible human output while keeping them in retrieval/search artifacts.
- Keep `/course-runtime/**` as the static raw runtime asset boundary. The raw Markdown route must continue to serve raw content for runtime tooling and tests.
- Add browser and unit gates so future textbook citations cannot regress to raw chunk pages or expose machine-only image description text to students.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `source-pack-retrieval`: Source Pack citation metadata must distinguish canonical runtime addresses from human-readable display hrefs when textbook citations need rendered targets.
- `konling-agent-runtime`: Konling textbook content citations must open rendered reader targets in student-facing citation UI while retaining canonical citation metadata for audit.
- `commercial-ui-governance-gates`: Citation-reader UI changes must include visual/browser evidence that rendered pages show formatted content and images without raw chunk leakage.

## Impact

- Affects Source Pack citation hydration/adaptation, Konling citation presentation, and the rendered textbook citation reader route.
- Reuses or extracts shared Markdown rendering from existing handout rendering instead of introducing a second Markdown implementation.
- Does not change retrieval ranking, answer relevance, textbook search-document generation, or the raw `/course-runtime` static route contract.
