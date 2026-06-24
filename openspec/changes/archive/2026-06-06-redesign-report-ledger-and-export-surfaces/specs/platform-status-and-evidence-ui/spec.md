## ADDED Requirements

### Requirement: Report status labels preserve privacy and provenance
Platform status and evidence UI SHALL preserve privacy, provenance, and confidence labels in report-ledger contexts.

#### Scenario: Report contains evidence-derived metrics
- **WHEN** a report displays evidence-derived metrics, recommendations, governance status, or learner outcomes
- **THEN** the report SHALL include source scope, freshness, confidence, privacy, and official/preview status where applicable
- **AND** those labels SHALL remain visible in screenshot, print, or export review.

### Requirement: Report examples cover classroom, Arena, learner, and governance contexts
Report-ledger UI SHALL be validated against representative report examples from each core platform role.

#### Scenario: Report-ledger migration is accepted
- **WHEN** report-ledger visual evidence is submitted
- **THEN** classroom, Arena, learner, and governance or data-center examples SHALL show source, timestamp, privacy, confidence, and official/preview labels
- **AND** watermark, texture, or brand treatment SHALL NOT obscure charts, formulas, names, tables, metrics, or privacy labels.
