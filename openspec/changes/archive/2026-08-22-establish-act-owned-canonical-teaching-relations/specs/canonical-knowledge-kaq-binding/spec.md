## MODIFIED Requirements

### Requirement: Conflicting teaching relations cannot remain jointly active
Path and recommendation consumers MUST NOT consume two conflicting knowledge-to-knowledge teaching relations from the formal ACT Teaching Projection and a scoped KAQ fallback. ActKG Engineering relations SHALL remain separately authoritative engineering facts and MUST NOT be classified as the conflicting teaching source.

#### Scenario: Conflict is unresolved
- **WHEN** the governed repository conflict decision has not completed or no matching retirement record exists
- **THEN** the affected ACT candidate SHALL remain unavailable to formal planning rather than being unioned with the KAQ fallback
- **AND** ActKG Engineering relations SHALL remain unchanged and independently queryable

#### Scenario: Conflict is resolved for ACT
- **WHEN** the governed decision admits the ACT relation and binds a matching KAQ fallback retirement record
- **THEN** the KAQ fallback SHALL retire before the ACT relation becomes active for the scoped consumers
- **AND** consumers SHALL resolve the teaching relation only from the selected ACT Teaching Projection
