## ADDED Requirements

### Requirement: Classical-control domains publish reviewed direct teaching semantics
The system SHALL publish reviewed core-node memberships and direct REQUIRED or RECOMMENDED ACT_TEACHING prerequisite relations for root locus, frequency-domain analysis and classical control design. Engineering derivation, application, analysis and association relations SHALL remain separate engineering semantics.

#### Scenario: Direct teaching dependency is accepted
- **WHEN** reviewers confirm a direct learning dependency with ACT evidence
- **THEN** the classical fragment SHALL publish the exact direction, strength and evidence
- **AND** the corresponding engineering relation, if any, SHALL retain its original predicate and layer

#### Scenario: Engineering adjacency is the only evidence
- **WHEN** two classical-control objects are connected only by an engineering relation
- **THEN** no teaching prerequisite SHALL be published
- **AND** the candidate SHALL remain non-blocking
