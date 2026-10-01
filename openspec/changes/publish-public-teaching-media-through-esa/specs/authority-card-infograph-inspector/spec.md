## ADDED Requirements

### Requirement: Accepted infograph media is public independently from graph access
The infograph image entrances SHALL allow anonymous reads of accepted content whose existing review, Authority/Teaching identity, content hash, locale and resource-version checks pass. Qualified public copies SHALL use immutable ESA redirects; an accepted image not in the enabled public delivery index SHALL retain an application-served public image fallback. This policy SHALL NOT relax authentication or role projections on graph, node-detail, review or learner-data APIs.

#### Scenario: Anonymous browser requests an accepted infograph
- **WHEN** the addressed image passes the existing publication and identity checks
- **THEN** the image entrance SHALL return the qualified ESA redirect or the accepted public image without requiring a session

#### Scenario: Image publication or resource reference is invalid
- **WHEN** the image is missing, unaccepted, hash-drifted or its required resource reference is stale
- **THEN** the entrance SHALL retain the existing bounded rejection and SHALL not publish draft bytes

#### Scenario: Anonymous browser requests graph or node-detail data
- **WHEN** the browser requests a protected knowledge-data endpoint rather than an infograph image
- **THEN** the endpoint SHALL retain its existing authentication and role boundary
