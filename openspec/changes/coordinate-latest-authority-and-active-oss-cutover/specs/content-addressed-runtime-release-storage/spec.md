## ADDED Requirements

### Requirement: Coordinated Runtime Release selection binds the complete graph and resource combination
A successor Runtime Release v2 used by the coordinated Authority and active OSS resource cutover SHALL bind the active-baseline-plus-explicit-delta denominator, formal atomic resource envelope, captured Authority, complete Teaching Projection, domain shards, prerequisite publication, shared consumer activation, coordination allocation record, and complete predecessor Runtime and graph identities. The later outer coordinated candidate receipt SHALL bind that immutable Runtime manifest and its materialization receipt. During activation, the Runtime active receipt SHALL bind the preallocated transaction ID and coordinated candidate receipt, but MUST NOT refer to the later final coordinated active receipt. Its desired selection, active receipt, rollback identity, and readiness projection MUST remain subordinate to the outer coordinated journal while that transaction is active. An ordinary Runtime lifecycle operation MUST NOT represent the successor as active when the coordinated graph combination has not committed.

#### Scenario: Successor Runtime Release closes over the coordinated envelope
- **WHEN** the Runtime manifest, materialization receipt, formal resource envelope, coordinated candidate, and graph successor identities all revalidate exactly
- **THEN** the Runtime Release MAY enter the stopped-service coordinated transaction
- **AND** its active receipt SHALL bind the transaction ID and coordinated candidate receipt before the final coordinated active receipt binds that Runtime active-receipt hash

#### Scenario: Runtime and graph successors differ
- **WHEN** the Runtime Release references a different Authority, Teaching Projection, resource denominator, binding set, shard set, prerequisite publication, consumer activation, or coordinated candidate
- **THEN** Runtime selection and coordinated activation SHALL fail before the active receipt changes

#### Scenario: Coordinated transaction fails after Runtime mutation
- **WHEN** a Runtime desired or active lifecycle mutation succeeds but any later coordinated selector, receipt, or readiness gate fails
- **THEN** the outer journal SHALL restore the exact predecessor Runtime lifecycle and graph selector combination while consumers remain stopped
- **AND** garbage collection SHALL continue to protect every predecessor, successor, rollback, and journal-reachable release

#### Scenario: Runtime candidate is independently newer
- **WHEN** a verified successor Runtime Release exists without a matching committed coordinated graph combination
- **THEN** readiness and media signing SHALL continue to project only the prior active Runtime identity
- **AND** the newer candidate SHALL remain non-active
