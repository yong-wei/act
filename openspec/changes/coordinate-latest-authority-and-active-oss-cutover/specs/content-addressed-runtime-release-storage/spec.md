## ADDED Requirements

### Requirement: Incremental Runtime publication separates local writes from ECS readback
For a daily v2 Runtime Release, the local production writer SHALL stream and conditionally write only changed or otherwise unknown blobs, the immutable receipt, and the terminal manifest. It SHALL not issue OSS metadata or body reads for an inherited parent binding. A bounded SSH readback bridge running on ECS under exactly `act-runtime-oss-read` SHALL use the regional internal OSS endpoint to determine which changed or unknown blobs need frames, validate any pre-existing changed or unknown Blob, validate every changed or unknown Blob after local conditional writes, and revalidate the immutable receipt and terminal manifest before completion. The bridge SHALL accept only the fixed readback phases and SHALL not expose a write operation in its ECS read mode. A missing Blob, malformed or mismatched metadata, legacy conditional-read failure, role mismatch, nonzero bridge result, or release-document mismatch SHALL fail before the terminal manifest is accepted; the surrounding lifecycle procedure SHALL cancel its owned publishing root and leave the active Runtime unchanged.

#### Scenario: Parent bindings remain outside daily readback
- **WHEN** a target logical entry has the same validated source identity and Blob binding as its protected parent Release
- **THEN** neither the local writer nor ECS readback bridge SHALL metadata-read, body-read, or upload that Blob

#### Scenario: Local writes are revalidated through ECS
- **WHEN** one or more changed or unknown Blob frames are accepted by the local writer
- **THEN** the ECS readback bridge SHALL verify their sizes and immutable SHA-256 metadata through the internal endpoint before the receipt or terminal manifest is written
- **AND** the publication receipt SHALL retain the verified Blob-set and transfer metrics

#### Scenario: ECS read identity is unavailable
- **WHEN** the remote bridge is invoked with a role other than `act-runtime-oss-read`, an unsupported phase, or a readback result that does not reconcile with the declared manifest
- **THEN** publication SHALL fail without a selectable Runtime Release or active-selector change

### Requirement: Coordinated Runtime Release selection binds the complete graph and resource combination
A successor Runtime Release v2 used by the coordinated Authority and active OSS resource cutover SHALL bind the active-baseline-plus-explicit-delta denominator, formal atomic resource envelope, captured Authority, complete Teaching Projection, domain shards, prerequisite publication, shared consumer activation, coordination allocation record, and complete predecessor Runtime and graph identities. Projection, prerequisite, catalog, shard, and consumer selectors SHALL be static members of that immutable Runtime view, not separately mutable host pointers. The later outer coordinated candidate receipt SHALL bind that immutable Runtime manifest and its materialization receipt. During activation, the Runtime binding SHALL bind the preallocated transaction ID and coordinated candidate receipt; the lifecycle MUST require a matching `coordinated-runtime-authorization/v1` sealed after mutable Authority mutation but before Runtime activation. The final coordinated active receipt is sealed only after the Runtime active identity re-reads and MUST bind that exact identity. Its desired selection, active receipt, rollback identity, and readiness projection MUST remain subordinate to the outer coordinated journal while that transaction is active. An ordinary Runtime lifecycle operation MUST NOT represent the successor as active when the coordinated authorization is absent or the final receipt has not been sealed.

#### Scenario: Successor Runtime Release closes over the coordinated envelope
- **WHEN** the Runtime manifest, materialization receipt, formal resource envelope, coordinated candidate, and graph successor identities all revalidate exactly
- **THEN** the Runtime Release MAY enter the stopped-service coordinated transaction
- **AND** the Runtime authorization SHALL bind the transaction ID, Authority mutation, coordinated candidate, and Runtime binding before the final coordinated active receipt binds the re-read Runtime identity

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
