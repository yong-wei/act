## ADDED Requirements

### Requirement: Effective resources use reviewed Canonical bindings
After the final production cutover, an effective teaching resource that is published, recommendable, path-eligible, or evidence-producing MUST resolve its knowledge scope through active Canonical binding entities rather than Legacy knowledge-node ID arrays.

#### Scenario: Effective resource is consumed
- **WHEN** a formal consumer loads an effective resource after the final selector activation
- **THEN** the registry SHALL expose its reviewed Canonical Object, Release, teaching role, and binding version

#### Scenario: Only Legacy IDs are present
- **WHEN** an effective resource has no active Canonical binding
- **THEN** the registry SHALL mark it not ready for Canonical cutover rather than inheriting a binding

#### Scenario: Effective resource is consumed before cutover
- **WHEN** a reviewed Canonical binding exists but Legacy remains the active authority
- **THEN** the formal registry response SHALL retain Legacy production identity and expose the Canonical binding only through migration review
