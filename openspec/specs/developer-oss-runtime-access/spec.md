# developer-oss-runtime-access Specification

## Purpose
TBD - created by archiving change enable-read-only-oss-runtime-for-developer-workstations. Update Purpose after archive.
## Requirements
### Requirement: Developer workstations discover one production active runtime identity
The developer runtime bootstrap SHALL obtain the production active blob-backed runtime identity from the configured HTTPS readiness endpoint. It SHALL accept only a ready v2 identity containing the expected manifest schema, Release ID, canonical manifest digest and logical tree digest, and SHALL pin that identity for the lifetime of the started development services.

#### Scenario: Development services start against the production active Release
- **WHEN** readiness reports a valid ready v2 runtime identity
- **THEN** bootstrap SHALL select only that Release, persist a credential-free local selection receipt, and keep the same Release until the services are stopped

#### Scenario: Production activates a new Release while development services run
- **WHEN** readiness changes after a development service has fixed its startup identity
- **THEN** the running service SHALL retain its original Release and the next startup SHALL resolve the new production active identity

#### Scenario: Readiness is unavailable or does not prove an active Release
- **WHEN** the endpoint is unavailable, non-HTTPS, not ready, malformed, unknown-version, or lacks any required identity digest
- **THEN** bootstrap SHALL fail before mounting runtime content and SHALL NOT infer the newest Release from OSS object order

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
Bootstrap SHALL fetch the selected v2 manifest named by readiness through the authenticated gateway, validate their Release ID, schema, canonical digest, logical tree digest, normalized path set and SHA-derived Blob keys, obtain a pin-time read lease for that identity, and expose only `runtime/blobs/sha256/` through a read-only gateway-backed adapter bound to that lease. It SHALL use the repository materializer to prepare, attach, verify and select a logical view, then expose that view read-only at the checkout's `course-content/runtime` path without deleting or overwriting the checkout directory.

#### Scenario: Active manifest and Blob adapter are valid
- **WHEN** the selected manifest matches readiness and every required mount, materialization and read-only check passes
- **THEN** bootstrap SHALL expose one manifest-bound filesystem view and start the existing development services against it

#### Scenario: Manifest identity or Blob content drifts
- **WHEN** the fetched manifest differs from readiness, a Blob is absent or mismatched, a materialized link escapes the Blob root, or the selected view receipt differs
- **THEN** bootstrap SHALL fail closed, leave development services stopped, and SHALL NOT select a candidate, previous package, checkout residue or public OSS fallback

#### Scenario: Mounted runtime is modified through the application path
- **WHEN** a process attempts to create, replace or delete content below the exposed `course-content/runtime`
- **THEN** the filesystem SHALL reject the write and preserve both the gateway-served objects and hidden checkout directory

#### Scenario: Matching startup is repeated
- **WHEN** the fixed readiness identity, lease, manifest identity, adapter source, read-only options, selected view and checkout bind all match a prior completed startup
- **THEN** bootstrap SHALL reuse the verified state without rebuilding or downloading the complete logical runtime

#### Scenario: Production switches while a leased checkout is running
- **WHEN** a checkout holds a valid gateway lease for its pinned Release and production later activates a different Release
- **THEN** that checkout SHALL keep fetching uncached Blobs from the leased allowlist and SHALL NOT be rewritten to the new active identity until the next startup

### Requirement: Runtime mount lifecycle is checkout-owned and recoverable
The developer adapter SHALL serialize machine-global Blob-mount state and
checkout-specific runtime-view state separately. It SHALL record only
credential-free identities, exact owned mount/bind identities, shared-mount
leases, and process evidence; start consumers only after checkout selection;
and stop consumers before releasing that checkout's bind and lease. Cleanup
SHALL affect only resources proven to belong to the target checkout and SHALL
preserve the shared Blob mount while another live lease exists, as well as
unknown paths and other worktrees.

#### Scenario: Normal shutdown releases the runtime
- **WHEN** the developer invokes the OSS-aware shutdown command
- **THEN** it SHALL stop that checkout's frontend, worker and scheduler before unmounting its exact bind and releasing its shared-mount lease

#### Scenario: Prior startup crashed
- **WHEN** a new startup finds a receipt, lease or mount left by an interrupted run
- **THEN** it SHALL verify process ownership, mount source, bind identity and live leases, then safely reuse or report the exact cleanup required without recursive deletion

#### Scenario: Another checkout still uses the Blob mount
- **WHEN** one checkout shuts down while another verified live lease remains
- **THEN** the adapter SHALL preserve the shared Blob mount and persistent cache for the remaining checkout

#### Scenario: Final verified lease is released
- **WHEN** no checkout process, bind or lease remains after serialized verification
- **THEN** the adapter MAY unmount the shared Blob mount while preserving the persistent cache and unknown data

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

### Requirement: Checkout Release selection remains independent
Each checkout SHALL continue to resolve, pin, validate, materialize, select, and
bind its own active Release identity even when Blob bodies are shared. A
production readiness change or another checkout's startup/shutdown MUST NOT
change the Release used by already running services.

#### Scenario: Worktrees pin different immutable Releases
- **WHEN** two worktrees start at different readiness observations whose manifests share some Blob digests
- **THEN** each SHALL retain its own logical view while shared digests reuse the same mount and cache bytes

#### Scenario: Production active Release changes
- **WHEN** readiness changes while a checkout is running
- **THEN** that checkout SHALL retain its fixed Release and only a later startup SHALL select the newer identity

### Requirement: Shared state and cache recover without cross-worktree loss
Global acquire, lease mutation, stale-state recovery, maintenance, and final
unmount SHALL run under a machine lock. Cache corruption SHALL invalidate or
refetch only proven affected cache data; maintenance MUST NOT delete a live
checkout view, an active bind, unknown data, credentials, or another
worktree's state.

#### Scenario: Stale lease is discovered
- **WHEN** its recorded checkout processes and bind are both proven absent
- **THEN** recovery SHALL reclaim only that lease and preserve every live lease and shared cache byte

#### Scenario: Cached entry fails verified read
- **WHEN** an affected Blob cannot produce the manifest-declared size and SHA-256
- **THEN** the adapter SHALL fail the consumer read, invalidate or quarantine only the proven cache entry, and require a verified refetch before reuse

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

### Requirement: Materialized developer runtime is readable and complete before services start
The developer runtime bootstrap SHALL validate the selected manifest's complete logical path set from the same Linux user context that will run the application. Every logical leaf MUST resolve through a relative link to the qualified Blob root, remain below that root, be traversable by the consumer user, and match the manifest-declared size from metadata (`stat`/`getattr`). Bootstrap SHALL also verify the required runtime governance artifact set for enabled application capabilities by opening that bounded JSON set. It MUST NOT open or hash the complete Blob body set during startup, because that would prefetch the runtime through the gateway FUSE data plane. Blob SHA-256 SHALL be proven on the unique cache write path when a consumer first reads the Blob. It MUST NOT start consumers or report runtime ready when any path, permission, size or required artifact check fails.

#### Scenario: Complete manifest-bound view is consumer-readable
- **WHEN** every manifest leaf resolves through a relative Blob link, metadata size matches the manifest, and all required governance artifacts are present
- **THEN** bootstrap SHALL start services against that fixed view and readiness SHALL report its Release, manifest digest, tree digest and successful filesystem verification. Blob body SHA-256 SHALL be proven later on the first consumer read through the cache write path.

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

### Requirement: Developer startup pins a stable resource-index revision
开发启动流程 SHALL 在 pin 活动 Runtime 身份后，为应用进程稳定供给与该身份一致的资源索引 revision 捕获（`APP_REVISION` 或受控 `.app-revision`），SHALL NOT 依赖偶然可用的 Git 工作目录状态；纯本地模式无 release 时 SHALL 显式声明并以受限状态呈现。

#### Scenario: Startup exports the pinned revision
- **WHEN** 协作者运行 `startup:oss-runtime` 且 bootstrap 完成活动身份 pin
- **THEN** 应用进程 SHALL 获得与该 pin 身份一致的资源索引 revision 供给
- **AND** git 捕获不可用（非 work tree、dubious ownership 等）SHALL NOT 导致资源接口以 `MISSING_CAPTURE`/500 失败

#### Scenario: Dirty capture semantics are explicit in development
- **WHEN** 本地 checkout 处于 dirty 状态
- **THEN** 开发模式 SHALL 仅在捕获与 pin 身份一致时接受该捕获，并在 readiness 中呈现 dirty 状态
- **AND** 跨 checkout 漂移或不一致捕获 SHALL fail-closed 并给出具体受限原因

#### Scenario: No silent local fallback for mounted-release delivery
- **WHEN** 已 pin release 的语境下请求 OSS 资源或媒体交付失败（对象不存在、权限拒绝、校验失败、release 不匹配）
- **THEN** 系统 SHALL 呈现具体受限原因，SHALL NOT 静默回退本地 fixture、页面内置样例或普通站内资源以伪造读取成功
- **AND** 失败资源 SHALL NOT 计入 OSS 覆盖与路径区分度


### Requirement: Gateway follows the activated pointer without receipt gates
The gateway SHALL derive the active identity and Blob access set from the manifest selected by `blob-views/current`. Audit receipts and publication receipts SHALL NOT gate lease issuance or developer bootstrap. Clients SHALL fetch the selected manifest without requiring the legacy receipt endpoint. Existing leases SHALL retain their pinned release across activation.

#### Scenario: Simplified activation omits publication receipts
- **WHEN** current selects a readable v2 manifest and its audit receipts are absent or stale
- **THEN** the gateway SHALL issue a lease for that identity and serve its manifest without receipt or wire-format qualification

### Requirement: Developer leases tolerate normal offline periods
Default transport credentials SHALL last 24 hours and leases SHALL tolerate 7 days without a heartbeat. Explicit stop and credential revocation SHALL remain effective immediately.

#### Scenario: Workstation resumes after a weekend
- **WHEN** a checkout resumes after three days without a heartbeat
- **THEN** it SHALL renew its transport and continue reading its pinned release without obtaining a new lease
