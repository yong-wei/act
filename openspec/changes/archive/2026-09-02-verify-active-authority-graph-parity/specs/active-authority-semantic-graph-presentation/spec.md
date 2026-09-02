## ADDED Requirements

### Requirement: Semantic graph completion is checked across every domain
Final acceptance SHALL verify each visible root domain has a bounded DomainConcept overview and at least one valid selected-neighborhood path or an explicitly verified relation-empty concept state. Seven missing-domain defaults or any client-flattened complete domain SHALL block completion.

#### Scenario: Domain coverage gate runs
- **WHEN** the active root advertises its domain catalog
- **THEN** every entry SHALL pass default-shard, hierarchy, search and detail closure checks
- **AND** no subset constant SHALL be accepted as the full denominator
