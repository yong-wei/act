## ADDED Requirements

### Requirement: Teaching Projection composes independently versioned domain fragments
The Teaching Projection builder MUST accept immutable reviewed domain fragments and MUST produce one deterministic composed manifest over their ordered identities and digests. Adding, removing or replacing a fragment MUST create a new projection version and MUST NOT mutate a previously published fragment.

#### Scenario: Identical fragment set is composed twice
- **WHEN** the same ordered fragments, Authority identity and builder version are composed twice
- **THEN** the composed manifest and projection hash SHALL be byte-identical

#### Scenario: One domain remains empty
- **WHEN** a valid fragment declares no published teaching edge for a domain
- **THEN** composition MAY publish with explicit empty coverage
- **AND** the empty domain SHALL NOT make unrelated fragments review-required
