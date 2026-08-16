# modern-domain-teaching-semantics Specification

## Purpose
TBD - created by archiving change publish-modern-domain-teaching-semantics. Update Purpose after archive.
## Requirements
### Requirement: Modern-control domains publish reviewed direct teaching semantics
The system SHALL publish reviewed core-node memberships and direct REQUIRED or RECOMMENDED ACT_TEACHING prerequisite relations for discrete-time control analysis and state-space control analysis and design. Cross-domain entry candidates SHALL not publish in this fragment unless they are independently accepted by the cross-domain change.

#### Scenario: Modern-control relation is accepted
- **WHEN** reviewers confirm a direct dependency within either modern-control domain
- **THEN** the fragment SHALL preserve exact endpoints, direction, strength and ACT evidence
- **AND** it SHALL not infer equivalence with continuous-domain engineering objects

#### Scenario: Cross-domain boundary remains pending
- **WHEN** a modern-control node has a proposed dependency on another domain without accepted cross-domain review
- **THEN** the local fragment SHALL omit that edge and remain publishable

