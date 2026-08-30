## ADDED Requirements

### Requirement: Materialized developer runtime is readable and complete before services start
The developer runtime bootstrap SHALL validate the selected manifest's complete logical path set from the same Linux user context that will run the application. Every logical leaf MUST resolve through a relative link to the qualified Blob root, remain below that root, be traversable and readable by the consumer user, and produce the manifest-declared size and SHA-256. Bootstrap SHALL also verify the required runtime governance artifact set for enabled application capabilities. It MUST NOT start consumers or report runtime ready when any path, Blob, permission, digest or required artifact check fails.

#### Scenario: Complete manifest-bound view is consumer-readable
- **WHEN** every manifest leaf resolves to a readable Blob with the declared size and digest and all required governance artifacts are present
- **THEN** bootstrap SHALL start services against that fixed view and readiness SHALL report its Release, manifest digest, tree digest and successful filesystem verification

#### Scenario: Blob target exists but consumer cannot read it
- **WHEN** link traversal or opening the target as the application user returns a permission error
- **THEN** bootstrap SHALL fail before starting frontend, worker or scheduler and SHALL identify the affected logical path without exposing credentials

#### Scenario: Required governance artifact is absent from the logical view
- **WHEN** an enabled capability requires an artifact declared by its runtime contract but the selected view does not expose it
- **THEN** bootstrap SHALL reject the view rather than allowing the application to reinterpret the delivery failure as missing business data

#### Scenario: Running view loses readability
- **WHEN** readiness verification after startup can no longer read or verify a previously accepted required artifact
- **THEN** runtime readiness SHALL become false and SHALL retain the pinned Release identity and a credential-safe failure class

### Requirement: Developer runtime repair preserves immutable authority and checkout ownership
Repair and recovery SHALL rebuild only the affected checkout-owned logical view and verified mount or lease state. It MUST NOT mutate OSS objects, select an unverified Release, overwrite tracked checkout content, delete another checkout's live state, or silently fall back to repository runtime files. A repaired view SHALL pass the same manifest, permission and consumer-read verification as a fresh startup before service restart.

#### Scenario: Checkout view has invalid links or permissions
- **WHEN** repair proves ownership of the affected bind, view and lease
- **THEN** it SHALL stop that checkout's consumers, rebuild and verify the view from the pinned immutable Release, then restart only after all gates pass

#### Scenario: Ownership or shared mount identity is uncertain
- **WHEN** repair cannot prove the target checkout, shared mount source, live leases or selected Release
- **THEN** it SHALL stop with an actionable diagnostic and preserve all uncertain state

#### Scenario: Rebuilt view still fails verification
- **WHEN** any manifest leaf, required artifact, permission, size or digest check fails after rebuild
- **THEN** the prior failure SHALL remain visible, services SHALL remain stopped, and no fallback runtime SHALL be selected

