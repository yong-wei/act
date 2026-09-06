# konling-kaq-graph-context Specification Delta

## ADDED Requirements

### Requirement: Engineering graph context enters grounding as a bounded neighborhood
The server-owned graph context SHALL expose engineering-domain knowledge to Konling as a bounded neighborhood summary derived from the engineering corpus, in addition to the existing focus-ID allowlist validation. The neighborhood summary MUST be limited to an allowlisted predicate set and a bounded entry count, and MUST retain engineering-domain provenance distinct from teaching-projection evidence.

#### Scenario: Engineering neighborhood summary is injected
- **WHEN** Konling answers a question whose focus Canonical IDs have engineering-graph neighbors under allowlisted predicates
- **THEN** the grounding context SHALL include a bounded engineering neighborhood summary with node identities, predicates, and directions
- **AND** the summary SHALL identify itself as engineering-domain grounding rather than teaching-projection evidence

#### Scenario: Neighborhood exceeds the bound
- **WHEN** the eligible engineering neighborhood for the focus set exceeds the configured entry limit
- **THEN** the context SHALL truncate to the bound deterministically
- **AND** the truncation SHALL be recorded in context metadata

#### Scenario: Engineering nodes carry textbook mappings
- **WHEN** an engineering node in the neighborhood has a governed textbook mapping to a structural unit of an extraction-source textbook
- **THEN** the context SHALL expose that mapping as a citation-eligible textbook reference with version-bound identity
- **AND** nodes without a governed mapping SHALL NOT be presented with a fabricated textbook source

#### Scenario: Engineering domain is unavailable
- **WHEN** the engineering corpus or layered payload is unavailable for the current Authority combination
- **THEN** the context SHALL expose that unavailability explicitly
- **AND** Konling SHALL NOT infer engineering relations from teaching-projection data or legacy knowledge nodes
