## MODIFIED Requirements

### Requirement: Shared workstation credentials are repository-external and read-only
The project SHALL use one project-lifetime shared gateway token whose effective permission is limited to authenticated GET of the current host-active v2 runtime through the ECS developer gateway. The token SHALL NOT possess SSH, IMDS, ECS RAM, OSS AccessKey, runtime publication, mutation, deletion, Bucket administration or Publisher permissions. All collaborators MAY share that one token only under the accepted short-term trust boundary.

#### Scenario: Bootstrap receives the expected gateway credential
- **WHEN** the configured credential resolves to the expected gateway URL and shared token schema
- **THEN** bootstrap SHALL continue only after confirming the credential shape without printing the token value

#### Scenario: Publisher, RAM or host credential is configured
- **WHEN** caller identity is an OSS AccessKey, Publisher principal, ECS operator, SSH key or any credential other than the declared gateway token
- **THEN** bootstrap SHALL fail before any Blob fetch or runtime bind

#### Scenario: Developer credential attempts OSS mutation
- **WHEN** the gateway token is used to upload, overwrite, copy, multipart-write, change ACLs or delete an OSS object, or to call a non-GET gateway method
- **THEN** the operation SHALL be denied and access verification SHALL treat any successful mutation as a blocking least-privilege failure

#### Scenario: Credential storage is unsafe
- **WHEN** a credential path is inside the repository, is a symlink, has unknown fields, or is readable or writable by group/other users
- **THEN** setup and startup SHALL refuse the credential and SHALL NOT copy it to `.env`, logs or another fallback path

### Requirement: Mixed workstations use one Linux runtime contract
The supported developer execution environments SHALL be native Linux, Windows WSL2 and a Linux virtual machine on macOS. The gateway-backed Blob adapter, the runtime materializer and all development service processes SHALL run in that same Linux environment with a supported architecture, FUSE device and required tools. The workstation SHALL fetch Blob bytes from the ECS active-runtime developer gateway and SHALL NOT use the ECS-only OSS internal endpoint or the public OSS regional endpoint as the default data plane.

#### Scenario: Supported Linux execution layer passes preflight
- **WHEN** Linux, WSL2 or the macOS Linux VM provides the required architecture, `/dev/fuse`, mount inspection, Python and Node tools, and can open HTTPS to the configured gateway
- **THEN** bootstrap SHALL allow the runtime preparation transaction to begin

#### Scenario: Native macOS, native Windows or incomplete FUSE environment is used
- **WHEN** the application and Blob adapter do not share the supported Linux environment or any required preflight check fails
- **THEN** bootstrap SHALL stop with a credential-safe diagnostic and SHALL NOT fall back to public ossfs2, macFUSE, WinFSP or another unverified mount adapter

### Requirement: Active runtime is verified and materialized without copying the logical tree
Bootstrap SHALL fetch the exact immutable v2 manifest and receipt named by readiness through the authenticated gateway, validate their Release ID, schema, canonical digest, receipt/wire binding, logical tree digest, normalized path set and SHA-derived Blob keys, obtain a pin-time read lease for that identity, and expose only `runtime/blobs/sha256/` through a read-only gateway-backed adapter bound to that lease. It SHALL use the repository materializer to prepare, attach, verify and select a logical view, then expose that view read-only at the checkout's `course-content/runtime` path without deleting or overwriting the checkout directory.

#### Scenario: Active manifest and Blob adapter are valid
- **WHEN** the immutable manifest/receipt match readiness and every required mount, materialization and read-only check passes
- **THEN** bootstrap SHALL expose one manifest-bound filesystem view and start the existing development services against it

#### Scenario: Manifest identity or Blob content drifts
- **WHEN** the fetched manifest/receipt differs from readiness, a Blob is absent or mismatched, a materialized link escapes the Blob root, or the selected view receipt differs
- **THEN** bootstrap SHALL fail closed, leave development services stopped, and SHALL NOT select a candidate, previous package, checkout residue or public OSS fallback

#### Scenario: Mounted runtime is modified through the application path
- **WHEN** a process attempts to create, replace or delete content below the exposed `course-content/runtime`
- **THEN** the filesystem SHALL reject the write and preserve both the gateway-served objects and hidden checkout directory

#### Scenario: Matching startup is repeated
- **WHEN** the fixed readiness identity, lease, manifest receipt, adapter source, read-only options, selected view and checkout bind all match a prior completed startup
- **THEN** bootstrap SHALL reuse the verified state without rebuilding or downloading the complete logical runtime

#### Scenario: Production switches while a leased checkout is running
- **WHEN** a checkout holds a valid gateway lease for its pinned Release and production later activates a different Release
- **THEN** that checkout SHALL keep fetching uncached Blobs from the leased allowlist and SHALL NOT be rewritten to the new active identity until the next startup

### Requirement: Onboarding and revocation separate documentation from Secret delivery
The repository SHALL provide a collaborator guide containing platform preparation, credential installation, identity verification, startup, shutdown, diagnostics and revocation cleanup without any real gateway token, AccessKey, Secret, signed URL, SSH key or credential-bearing command history. The user SHALL distribute the actual gateway token through a repository-external password manager or end-to-end encrypted channel only after one controlled real-environment smoke succeeds.

#### Scenario: Collaborator receives access
- **WHEN** the implementation and controlled gateway smoke have passed
- **THEN** the collaborator SHALL receive the credential-free guide through normal project channels and the gateway token through a separate controlled channel

#### Scenario: Project ends or credential is suspected leaked
- **WHEN** access must end
- **THEN** the operator SHALL rotate or delete the gateway token first, verify that new startups are denied, and direct collaborators to remove local credential and adapter state without distributing SSH or OSS AccessKey material

### Requirement: Immutable Blob mount and data cache are workstation-shared
All ACT worktrees in the same supported Linux execution layer SHALL share one read-only gateway-backed Blob adapter and one repository-external persistent data cache for an identical verified gateway authority, adapter schema, active-manifest digest class and mount-options identity. A mismatch SHALL create a separate qualified identity or fail before reuse.

#### Scenario: Two worktrees use the same Blob authority
- **WHEN** both worktrees pass token and adapter preflight for the same gateway authority
- **THEN** they SHALL acquire leases on one verified read-only adapter and data-cache identity

#### Scenario: Existing global mount identity drifts
- **WHEN** source, gateway authority, token principal, prefix, options, process, or writability differs from the expected shared identity
- **THEN** startup SHALL fail before binding Runtime content or starting services

### Requirement: Shared caching remains on-demand and transfer-verifiable
The shared data cache SHALL retrieve a SHA-addressed Blob only when a consumer reads it, SHALL use a bounded cache policy, and SHALL expose credential-safe operation evidence sufficient to distinguish a gateway body transfer from a local cache read. It SHALL NOT eagerly mirror the complete Runtime namespace and SHALL NOT perform that transfer against public OSS.

#### Scenario: First worktree reads an uncached Blob
- **WHEN** the Blob is absent from the qualified persistent cache
- **THEN** the adapter SHALL fetch it on demand from the ECS gateway and record one body-transfer operation class without exposing authorization data

#### Scenario: Second worktree reads the same cached Blob
- **WHEN** the identical verified Blob remains in the shared cache
- **THEN** the read SHALL return the manifest-declared bytes without another gateway body transfer

## REMOVED Requirements

### Requirement: Public OSS use is bounded and observable
**Reason**: Developer Blob transport now uses the ECS active-runtime gateway; public Hangzhou OSS is no longer the workstation data plane.
**Migration**: Use `startup:oss-runtime` with the gateway token. Do not configure ossfs2 against `https://oss-cn-hangzhou.aliyuncs.com` or `act-runtime-dev-read`.

## ADDED Requirements

### Requirement: Developer startup defaults to the ECS gateway data plane
`startup:oss-runtime` SHALL use the ECS active-runtime developer gateway as the default Blob transport after readiness pins an active identity. It SHALL refuse to start if it would need the public OSS endpoint, an OSS AccessKey or an ECS internal endpoint on the workstation.

#### Scenario: Default startup uses the gateway
- **WHEN** a collaborator with a valid gateway token runs the existing OSS-aware startup command
- **THEN** Blob fetches SHALL go to the gateway and development services SHALL start against the materialized active view

#### Scenario: Public OSS fallback is requested
- **WHEN** bootstrap detects a public OSS endpoint, ossfs2 public mount or `act-runtime-dev-read` AccessKey as the intended data plane
- **THEN** it SHALL fail closed before binding `course-content/runtime`

### Requirement: Developer media bodies stay on the gateway path
Development services SHALL serve lesson media from the materialized active view whose Blob bytes arrived through the gateway cache. They SHALL NOT generate public OSS signed URLs and SHALL NOT require `ACT_RUNTIME_OSS_RAM_ROLE` on the workstation.

#### Scenario: A lesson video plays after startup
- **WHEN** the local application reads a media file that is not yet in the shared cache
- **THEN** the adapter SHALL retrieve that Blob through the gateway and the browser SHALL receive the manifest-declared bytes from the local development origin

#### Scenario: Signed public OSS redirect is attempted in development
- **WHEN** development media resolution would redirect the browser to a public OSS URL
- **THEN** the service SHALL serve or fail from the local materialized view instead of issuing that redirect
