## ADDED Requirements

### Requirement: Citation-reader UI evidence prevents raw corpus leakage
Commercial UI governance SHALL require visual and browser evidence when learner-facing citation targets are changed from raw corpus assets to rendered source pages.

#### Scenario: Rendered textbook citation page is reviewed
- **WHEN** a PR changes Konling textbook citation target rendering, citation links, or the textbook citation reader route
- **THEN** review evidence SHALL include timestamped browser screenshots or recording-grade artifacts for at least one image-containing textbook chunk citation at desktop and 320px mobile widths
- **AND** the evidence SHALL show formatted text, loaded rendered images when the chunk includes images, readable formulas where present, and no visible raw Markdown comments, raw image URLs, or machine-only image-description prose.

#### Scenario: Citation link is reviewed from Konling UI
- **WHEN** a PR changes the Konling citation presentation path for textbook Source Pack citations
- **THEN** review evidence SHALL show that the actual Konling citation chip or citation panel click opens the rendered reader target
- **AND** audit metadata or tests SHALL still prove the canonical runtime href is retained.
