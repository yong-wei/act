# ecs-active-runtime-developer-gateway Specification

## Purpose
ECS 上的开发机激活 runtime 只读网关：共享 Bearer 令牌、签发时 host-active 的 pin-time 租约、冻结允许集，以及与学生 ossfs/媒体签名隔离。
## Requirements
### Requirement: Gateway authenticates collaborators without host or OSS credentials
The developer runtime gateway SHALL accept a single project-lifetime shared bearer token stored outside the repository. The token SHALL authorize only lease issuance for an identity that is host-active at issue time, and GET of objects allowlisted by a valid lease. It SHALL NOT grant SSH, IMDS, ECS RAM role assumption, OSS AccessKey use, runtime publication, object mutation, or listing of non-leased prefixes.

#### Scenario: Valid shared token with a valid lease reads leased content
- **WHEN** a request presents the configured gateway token and a valid lease, and asks for an object allowlisted by that lease
- **THEN** the gateway SHALL return those bytes and SHALL NOT log the token or lease secret

#### Scenario: Missing or unknown token is denied
- **WHEN** a request omits the token, uses a revoked token, or places the token in a query string
- **THEN** the gateway SHALL reject the request before reading Blob bytes

#### Scenario: Host or publisher credentials are presented
- **WHEN** a caller supplies an SSH identity, OSS AccessKey, Publisher principal or ECS role token to the gateway
- **THEN** the gateway SHALL NOT treat them as credentials and SHALL NOT broaden access

### Requirement: Gateway issues a pin-time lease only for the host-active Release
The gateway SHALL issue a read lease only when the requested Release ID, canonical manifest digest and logical tree digest match the host active receipt and the matching immutable v2 manifest at that instant. The lease SHALL freeze that manifest's SHA-256 allowlist, SHALL NOT expand to another Release, and SHALL remain valid until the owning checkout stops or the shared gateway token is rotated. A wall-clock TTL SHALL NOT terminate a lease while that checkout is proven live. Short-lived transport credentials MAY expire, but the gateway SHALL renew them only for the same live lease without changing the Release or allowlist and without requiring the leased identity to remain host-active. The gateway SHALL NOT issue a lease for candidate, rollback or other non-active identities.

#### Scenario: Matching active identity receives a lease
- **WHEN** bootstrap presents the current host-active identity with a valid shared token
- **THEN** the gateway SHALL issue a lease bound to that exact identity and frozen allowlist

#### Scenario: Non-active identity cannot obtain a lease
- **WHEN** the requested identity is a candidate, rollback, historical Release, or no longer equals the current host-active receipt
- **THEN** the gateway SHALL refuse the lease and SHALL NOT serve that identity's objects without a previously issued still-valid lease

### Requirement: Leased Blob reads keep a pinned checkout readable after production switches
After a lease is issued, Blob GET SHALL use that lease's frozen allowlist rather than the live host-active manifest. The gateway SHALL read matching bytes from the ECS-local view or internal ossfs Blob root and SHALL NOT call OSS with a collaborator identity.

#### Scenario: Pinned checkout reads an uncached Blob after a later activation
- **WHEN** a checkout holds a valid lease for Release A and production later activates Release B
- **THEN** GET of a digest listed only in A's leased allowlist SHALL still return the matching bytes until the lease expires

#### Scenario: Digest outside the lease is refused
- **WHEN** the digest exists on the shared OSS Blob prefix or ossfs mount but is absent from the presented valid lease allowlist
- **THEN** the gateway SHALL refuse the object and SHALL NOT reveal whether the Blob exists in OSS

#### Scenario: Live active identity drifts for new startups
- **WHEN** the active receipt and materialized manifest no longer bind the same Release ID, manifest digest and tree digest
- **THEN** the gateway SHALL refuse new leases and SHALL NOT mint a lease from a candidate, rollback or drifted identity

#### Scenario: Expired or missing lease cannot read blobs
- **WHEN** a Blob GET has no lease, a lease released by checkout stop, or a lease revoked by shared-token rotation
- **THEN** the gateway SHALL reject the read before returning object bytes

#### Scenario: Transport credential renews on a live pinned lease
- **WHEN** a checkout still holds a live lease for Release A, production has activated Release B, and the short-lived transport credential expires
- **THEN** renewal SHALL reissue transport access for the same A allowlist and SHALL NOT require A to be host-active

#### Scenario: Heartbeats prove a checkout is still live
- **WHEN** the checkout's gateway adapter continues to heartbeat within the grace interval
- **THEN** the lease SHALL remain live and transport renewal SHALL succeed even after a wall-clock duration longer than the transport TTL

#### Scenario: Lost checkout without DELETE does not keep a perpetual lease
- **WHEN** heartbeats stop beyond the grace interval after a crash or kill, and the checkout did not DELETE the lease
- **THEN** the gateway SHALL treat the lease as not live, SHALL NOT restore it from the lease store, and SHALL reject transport renewal and Blob GET

### Requirement: Gateway isolation does not weaken production serving
The gateway process, reverse-proxy path and rate limits SHALL be isolated from student runtime serving. Gateway faults SHALL NOT unmount production ossfs, SHALL NOT change selectors, and SHALL NOT disable student media signing.

#### Scenario: Gateway is overloaded or stopped
- **WHEN** the developer gateway returns errors or is not running
- **THEN** the production app and worker runtime binds SHALL remain available

#### Scenario: Student media request does not use the gateway
- **WHEN** a production browser requests runtime media
- **THEN** delivery SHALL continue to use the existing short-lived signed redirect and SHALL NOT require the developer gateway token
