## ADDED Requirements

### Requirement: Runtime selection is qualified by the deployed application's real consumers
For every newly selected blob-backed Runtime Release, the Runtime activator SHALL mount the candidate for the currently deployed application, restart its Runtime consumers, require local readiness, and execute the declared in-container structured-runtime, route, media, textbook-reader, hybrid-index, and knowledge consumer smoke checks. The candidate SHALL become active only after those checks pass. Runtime `authoringRevision`, application Git revision, image digest, migration-set digest, and a synthetic consumer-contract value SHALL NOT be used as compatibility gates.

#### Scenario: A later application consumes an unchanged Runtime
- **WHEN** a materialized Runtime candidate is internally valid and the deployed application revision differs from its Runtime provenance
- **THEN** the activator SHALL select it only if the actual consumer smoke and readiness checks pass
- **AND** it SHALL not require Runtime regeneration solely because the revisions differ

#### Scenario: A candidate consumer fails
- **WHEN** any declared consumer or media resolver smoke fails after temporary candidate selection
- **THEN** the activator SHALL restore the prior Runtime and application state before committing active lifecycle state
- **AND** it SHALL not write a passing compatibility receipt

## REMOVED Requirements

### Requirement: Compatibility proof binds independently frozen application and Runtime identities
**Reason**: Immutable application/image/migration receipts are proxies for consumption and do not test whether the deployed application can read the candidate Runtime.
**Migration**: Use the deployed application's readiness and declared candidate-consumer smoke checks before Runtime selection.

### Requirement: Compatibility qualification uses the actual deployed consumer environment
**Reason**: The consumer smoke remains necessary, but recording application, image, migration, and contract identities in a separate receipt is not.
**Migration**: Keep the smoke and rollback behavior; remove compatibility receipt capture and identity comparison.

### Requirement: Compatibility proof is revalidated under the selection transaction
**Reason**: The selection transaction needs the actual consumer result, not an additional receipt hash and repeated identity comparisons.
**Migration**: Commit the active Runtime only after readiness and consumer smoke succeed; retain the existing rollback transaction.
