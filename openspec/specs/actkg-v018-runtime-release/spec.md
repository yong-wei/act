# actkg-v018-runtime-release Specification

## Purpose
TBD - created by archiving change publish-actkg-v018-cutover-runtime. Update Purpose after archive.
## Requirements
### Requirement: Runtime publication freezes one qualified application revision

The release workflow MUST bind one clean Git commit and tree, qualified v0.18
candidate manifest, external runtime identity, image tag, OCI labels, exported
image digest, and provenance receipt. Build or deployment input drift MUST stop publication.

#### Scenario: Qualification evidence belongs to another revision

- **WHEN** the candidate or application identity differs from the frozen release input
- **THEN** the workflow MUST fail before building or uploading a production image

### Requirement: Local migrations and production build gates pass before remote work

The workflow MUST prove local migration deployment and status, TypeScript,
required tests, container Next compilation, image export, OCI revision labels,
and provenance. Docker memory preflight MUST require at least 20 GiB available,
use the documented 24 GiB RAM / 8 GiB swap target, and pass a 12 GiB Node heap.

#### Scenario: Docker VM memory is below the gate

- **WHEN** Docker reports less than 20 GiB total memory
- **THEN** the build MUST fail fast with the 24 GiB configuration instruction

#### Scenario: Any migration, build, export, or provenance check fails

- **WHEN** a required local release gate fails
- **THEN** no remote deployment action SHALL begin

### Requirement: Deployment retains the complete v0.9 current pointer set

The cutover-capable app and worker MAY be refreshed and the sealed v0.18
candidate MAY be staged, but Authority, Teaching Projection, prerequisite,
Authority domain-shard, and consumer-activation selectors MUST remain
byte-identical v0.9 identities before, during, and after deployment.

#### Scenario: Runtime refresh succeeds

- **WHEN** the new containers and staged candidate pass health checks
- **THEN** normal production reads SHALL still resolve the v0.9 release set

#### Scenario: A deployment step changes a knowledge pointer

- **WHEN** any current pointer hash differs from the frozen v0.9 predecessor
- **THEN** deployment MUST fail, restore the prior application runtime where
  possible, and MUST NOT classify the host as cutover-ready

### Requirement: Host verification proves current and shadow paths separately

The deployed revision MUST pass public v0.9 behavior and controlled v0.18
candidate shadow checks for labels, teaching queries, six consumers, app/worker
health, and readiness without changing shared selectors.

#### Scenario: Current v0.9 passes but candidate shadow fails

- **WHEN** production remains healthy but any v0.18 shadow check fails
- **THEN** the deployment receipt SHALL record the blocker and production cutover
  MUST remain unauthorized

### Requirement: Release cleanup closes local build resources

After release verification and when no other build owns Docker, the workflow
MUST stop Docker Desktop to release host memory and record completion in the receipt.

#### Scenario: Release verification completes

- **WHEN** image, deployment, and shadow evidence has been sealed and no build remains
- **THEN** Docker Desktop SHALL be closed without stopping unrelated validation services

