## ADDED Requirements

### Requirement: Konling textbook citations open rendered source pages
Konling SHALL route student-facing textbook content citation clicks to rendered source pages rather than raw runtime Markdown chunks.

#### Scenario: Citation points to a textbook chunk
- **WHEN** Konling presents a verified textbook Source Pack citation whose canonical href points to a runtime Markdown chunk
- **THEN** the student-facing citation link SHALL open a platform-owned rendered reader page for that chunk
- **AND** Konling SHALL retain the canonical runtime href, citation target id, source id, answer-relevance audit metadata when present, missing or downgraded citation reason, confidence, freshness, privacy scope, and limitation metadata for audit and citation verification.

#### Scenario: Citation display href is generated after relevance governance
- **WHEN** Source Pack supplies answer-relevance audit metadata, omitted-citation metadata, or no-relevant-citation downgrade reasons
- **THEN** Konling SHALL preserve that metadata while adding or consuming the rendered display href
- **AND** it SHALL NOT change `konling-answer` selection, ranking, omission, or downgrade semantics solely because a rendered display href is available.

#### Scenario: Citation points to a section or figure anchor
- **WHEN** a textbook citation includes section, figure, image, equation, or anchor metadata
- **THEN** the rendered reader SHALL navigate to or highlight the relevant target when supported
- **AND** unsupported anchors SHALL degrade to the rendered containing chunk or section with an explicit non-student-facing limitation state.

#### Scenario: Citation target is unavailable
- **WHEN** the rendered target cannot be resolved safely, is restricted, or is stale
- **THEN** Konling SHALL show the existing unavailable or limited citation state
- **AND** it SHALL NOT synthesize raw Markdown links or model-authored fallback links.

### Requirement: Konling rendered citation pages hide raw chunk machinery
Konling rendered citation pages SHALL display textbook citations as formatted reading content rather than raw corpus artifacts.

#### Scenario: Rendered chunk includes Markdown and images
- **WHEN** a learner opens a rendered textbook citation page for a chunk containing headings, formulas, lists, image links, and machine image descriptions
- **THEN** the page SHALL render formatted Markdown, formulas, and images
- **AND** it SHALL NOT show raw Markdown image syntax, citation comments, section-id comments, or visible `Image description` retrieval prose.

#### Scenario: Raw runtime route is requested directly
- **WHEN** tooling or a developer opens the canonical `/course-runtime/**` Markdown href directly
- **THEN** the raw Markdown asset MAY still be served as raw Markdown
- **AND** this raw behavior SHALL NOT be used as the student-facing citation click target.
