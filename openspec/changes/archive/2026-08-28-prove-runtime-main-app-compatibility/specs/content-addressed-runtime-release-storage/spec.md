## MODIFIED Requirements

### Requirement: Materialized runtime preserves the selected logical release
The system SHALL build a temporary host-owned materialized runtime view only from blobs reachable in one verified manifest. When a matching parent view is available, it SHALL derive the candidate from local directory/symlink topology plus manifest delta and write a receipt binding manifest identity, path set, blob set, helper mount and hot-cache identities. Before selection it SHALL validate path topology, changed links and the receipt rather than rehashing every inherited blob, require the blob mount and materialized view to be read-only to application consumers, and atomically select the view under the host lifecycle lock. The application SHALL continue to receive exactly one read-only bind at `/app/course-content/runtime`. If the host restores persistent control-plane state after materialization, it SHALL copy only repository-defined control-plane paths, SHALL NOT copy a textbook retrieval cache or other runtime data merely because it is a regular file, and SHALL repeat a coverage-aware materialized-view verification before any consumer switch or active lifecycle commit. For every newly selected v2 Runtime Release, the candidate receipt and active lifecycle evidence SHALL additionally bind a verified `runtime-app-compatibility.v1` receipt for the exact candidate manifest and current application image; a matching application and Runtime Git revision SHALL NOT be required.

#### Scenario: Missing or mismatched blob blocks selection
- **WHEN** a selected manifest references a missing blob, a blob with a different size or SHA-256, or a dangling materialized entry
- **THEN** candidate readiness SHALL fail and the prior active runtime SHALL remain selected

#### Scenario: Candidate materialization proves filesystem compatibility
- **WHEN** the materialization strategy is evaluated before production selection
- **THEN** the system SHALL run the declared filesystem-consumer, route, media and textbook-retrieval evidence against the candidate view and SHALL not select it when any required contract differs

#### Scenario: Host control-plane restoration encounters a regular textbook cache
- **WHEN** a parent view contains regular textbook retrieval cache files and a candidate release declares different cache hashes
- **THEN** restoration SHALL leave the candidate cache bound to its own manifest
- **AND** it SHALL preserve only explicit control-plane overlays
- **AND** it SHALL reject the candidate before consumer switch if post-restoration verification finds any non-overlay logical file that differs from the candidate manifest

#### Scenario: Compatibility proof is absent after materialization
- **WHEN** a new candidate has a valid materialized view but no matching runtime-app compatibility proof for the current application image
- **THEN** the system SHALL not write desired or active Runtime selection state
- **AND** the prior active Runtime view SHALL remain mounted
