## ADDED Requirements

### Requirement: Formula canvas identity presents mathematics rather than prose substitution
A visible Formula node SHALL present its governed mathematical expression as the primary canvas label and its governed human name as bounded supporting context. A prose-only title MUST NOT be treated as complete Formula canvas presentation.

#### Scenario: Viewer discloses a Formula neighbor
- **WHEN** a concept's published one-hop network contains a Formula
- **THEN** the canvas SHALL show the formatted expression with its Formula glyph and bounded human context
- **AND** search, hover, accessibility and inspector SHALL resolve the same stable object identity
