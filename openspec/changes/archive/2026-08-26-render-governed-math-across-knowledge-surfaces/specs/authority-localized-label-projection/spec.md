## ADDED Requirements

### Requirement: Governed rich titles take precedence over plain Formula labels
When the selected Authority release provides a qualified localized rich-text title, the label projection SHALL preserve that title's explicit text and math spans for user-facing presentation. The existing plain display label SHALL remain a non-mathematical compatibility, search, and unavailable-state input and MUST NOT be parsed as TeX. Identity and association SHALL continue to use stable internal keys.

#### Scenario: Formula title has qualified inline spans
- **WHEN** a presentable Formula object has a same-release localized rich-text title with qualified math spans
- **THEN** canvas, search, preview, accessibility, and inspector projections SHALL use that rich title
- **AND** the plain display label SHALL NOT be independently parsed or displayed as a competing formula

#### Scenario: Rich title is unavailable
- **WHEN** a formulaized title cannot produce a meaningful reviewed presentation after its math failures are applied
- **THEN** the ordinary product graph SHALL treat the object as having an unavailable governed name
- **AND** only the development-only unavailable-name artifact MAY expose its bounded unavailable state
