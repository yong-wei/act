## MODIFIED Requirements

### Requirement: Materialized runtime preserves the selected logical release
The system SHALL build a temporary host-owned materialized runtime view only from blobs reachable in one verified manifest. When a matching parent view is available, it SHALL derive the candidate from local directory/symlink topology plus manifest delta and write a receipt binding manifest identity, path set, blob set, helper mount and hot-cache identities. Before selection it SHALL validate path topology, changed links and the receipt rather than rehashing every inherited blob, require the blob mount and materialized view to be read-only to application consumers, and atomically select the view under the host lifecycle lock. The application SHALL continue to receive exactly one read-only bind at `/app/course-content/runtime`. If the host restores persistent control-plane state after materialization, it SHALL copy only repository-defined control-plane paths, SHALL NOT copy a textbook retrieval cache or other runtime data merely because it is a regular file, and SHALL repeat a coverage-aware materialized-view verification before any consumer switch or active lifecycle commit. Before committing the active lifecycle state, the deployed application SHALL pass readiness and its declared candidate-consumer smoke checks against that selected view. A matching application and Runtime Git revision SHALL NOT be required, and no compatibility-proof receipt SHALL be required.

#### Scenario: Missing or mismatched blob blocks selection
- **WHEN** a selected manifest references a missing blob, a blob with a different size or SHA-256, or a dangling materialized entry
- **THEN** the materializer SHALL reject the candidate before consumer switch
- **AND** the prior active Runtime view SHALL remain mounted

#### Scenario: Restored control-plane state changes a logical entry
- **WHEN** a candidate reuses a parent view and host overlay restoration changes a non-overlay logical Runtime entry
- **THEN** the materializer SHALL reject the candidate before consumer switch
- **AND** it SHALL retain the prior active Runtime view

#### Scenario: Candidate smoke is absent or fails after materialization
- **WHEN** a candidate view is materialized but the deployed application does not pass readiness or a declared candidate-consumer smoke
- **THEN** the system SHALL not write active Runtime selection state
- **AND** it SHALL restore the prior Runtime view and application state

### Requirement: Coordinated Runtime Release selection binds the complete graph and resource combination
A successor Runtime Release v2 used by the coordinated Authority and active OSS resource cutover SHALL bind the active-baseline-plus-explicit-delta denominator, formal atomic resource envelope, captured Authority, complete Teaching Projection, domain shards, prerequisite publication, shared consumer activation, coordination allocation record, and complete predecessor Runtime and graph identities. Projection, prerequisite, catalog, shard, and consumer selectors SHALL be static members of that immutable Runtime view, not separately mutable host pointers. The later outer coordinated candidate receipt SHALL bind that immutable Runtime manifest and its materialization receipt. During activation, the Runtime binding SHALL bind the preallocated transaction ID and coordinated candidate receipt; the lifecycle MUST require a matching `coordinated-runtime-authorization/v1` sealed after mutable Authority mutation but before Runtime activation. The final coordinated active receipt is sealed only after the Runtime active identity re-reads and MUST bind that exact identity. Its desired selection, active receipt, rollback identity, and readiness projection MUST remain subordinate to the outer coordinated journal while that transaction is active. An ordinary Runtime lifecycle operation MUST NOT represent the successor as active when the coordinated authorization is absent or the final receipt has not been sealed. The historical stopped-service coordinated branch SHALL preserve its explicit declaration, authorization, binding, and recovery behavior. Neither ordinary nor coordinated activation SHALL create or require a runtime-app compatibility proof; the active application consumer smoke remains the compatibility gate whenever consumers run.

#### Scenario: Historical coordinated transition has explicit migration intent
- **WHEN** the established outer coordinated transaction stops all consumers and provides its declaration, authorization, binding and explicit migration intent
- **THEN** the Runtime activator SHALL preserve the stopped-service coordinated branch and return control to the outer journal before consumer restart
- **AND** it SHALL not create or require a daily compatibility proof

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
