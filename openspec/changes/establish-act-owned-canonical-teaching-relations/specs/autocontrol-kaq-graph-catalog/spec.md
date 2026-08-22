## MODIFIED Requirements

### Requirement: Teaching relation conflicts are auditable
The catalog SHALL record one-time governed conflict decisions and retirement status when a formally admissible ACT Teaching Projection relation conflicts with an existing scoped KAQ knowledge-to-knowledge fallback. An ActKG Engineering relation SHALL NOT participate in this retirement contract and SHALL remain unchanged. A conflicting ACT candidate MUST remain excluded until the repository decision resolves the conflict.

#### Scenario: ACT relation is admitted after conflict resolution
- **WHEN** the governed repository decision accepts the ACT Teaching Projection relation that conflicts with a scoped KAQ fallback
- **THEN** the corresponding KAQ knowledge relation SHALL be retired before the ACT relation becomes active for planning
- **AND** no ActKG Engineering relation SHALL be retired, relabeled, or copied by that decision

#### Scenario: ACT and KAQ conflict is unresolved
- **WHEN** the conflict decision is rejected, deferred, missing, or identity-drifted
- **THEN** the ACT candidate and conflicting KAQ fallback SHALL NOT become jointly active for formal planning
- **AND** the unresolved ACT candidate SHALL remain in the repository review pack
