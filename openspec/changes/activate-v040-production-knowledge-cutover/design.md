## Context

The released `v0.4.0` image is pinned to `58f70df257f493f7dc13b2dabfb0383b972ee017`. It already contains the immutable, locally committed first-activation package:

- Authority Snapshot `snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7` for `ctr:release:control-theory-engineering-v0.9`.
- Teaching Projection `proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d`.
- Prerequisite publication `proj-b8100a7f322e588a620a2869b5fccafa22d501de9a85bb5882a7c56e9528a21b`.
- Consumer activation `first-cutover-7f4cdd1084af-769b1a832622`, with six `READY` consumers and zero shadow discrepancies.

The normal release script intentionally removes or excludes production selectors, so the remote app is healthy but in Legacy mode. Its runtime release directories already hash-match `v0.4.0`; the remote Authority host mount and all four selectors are absent. The completed local change explicitly excluded remote deployment, so production activation must be a separately auditable operation.

## Goals / Non-Goals

**Goals:**

- Activate exactly the frozen `v0.4.0` package on the remote host without rebuilding or retagging the application image.
- Use the existing `executeFirstActivation` protocol under an ephemeral container running the same image, rather than reimplementing pointer semantics in shell.
- Preserve an independently versioned production plan, write-ahead journal, receipt, and recovery path.
- Prevent the normal Legacy deployment command from deleting an active production selector set.

**Non-Goals:**

- Retire Legacy readers, snapshots, crosswalks, or historical audit evidence.
- Promote the database candidate import, Canonical resource-binding shadow inventory, or KAQ selectors. Their `cutoverReady` state is a separate consumer boundary.
- Change ActKG content, CourseCoverage decisions, schemas, or the `v0.4.0` image.

## Decisions

### Execute a data-plane transaction, not a new image release

The application image and runtime artifacts already meet the release identity and local readiness requirements. Creating `v0.4.1` only to alter an operator path would change the fixed application revision without improving the graph package. The production transaction is therefore separately versioned and records the immutable application revision it activates.

### Reuse the tested TypeScript first-activation coordinator in an ephemeral v0.4.0 container

The operator tool stages files over SSH and then runs a read-write, root-owned ephemeral container from the exact deployed image. It mounts the production content root at a distinct writable path and invokes the repository's `executeFirstActivation`, `activateAuthoritySnapshot`, `activateTeachingProjection`, `activatePrerequisitePublication`, and `activateConsumerActivation` functions. This preserves the tested lock, journal, atomic-write, identity-check, and compensation semantics. The live app and worker remain stopped until the transaction has committed.

### Treat the consumer selector as the commit point

Authority, Projection, and prerequisite selectors are written in the existing fixed order. The shared consumer selector is last. Any failure before it commits triggers identity-constrained compensation to all-ABSENT; no app or worker starts in cutover mode until all four post-reads succeed.

### Seal and retain a production plan outside the component journal

The first-activation journal schema intentionally stores only pointer-state coordination. A companion production plan and receipt record the target image revision, OCI config digest, source tar SHA-256, capture revision, source Release identity, expected artifact hashes, initial ABSENT observations, the operator-tool and deployment-script hashes, timestamps, and post-cutover verification. Both are persisted under the runtime cutover transaction directory and checked before activation.

### Guard future Legacy-oriented remote deployments

After a committed production receipt exists, `scripts/remote-deploy.sh` must fail before stopping consumers or synchronizing runtime. A future update must use a cutover-aware operation; it cannot reuse the pointer-deleting Legacy path.

## Risks / Trade-offs

- [Four selectors cannot be one filesystem atomic write] → lock the complete operation, use durable journal writes and identity-constrained compensation, and do not start consumers before all post-reads pass.
- [Remote artifact drift or incomplete transfer] → stage outside live stores, validate every expected hash and cross-artifact identity before any selector write.
- [Mixed Legacy/CUTOVER processes] → stop all graph consumers first; replace app and worker only after selector commit, using the immutable existing image.
- [A later normal deployment deletes selectors] → persist a production cutover marker and have the normal remote deployment script fail before any remote mutation.
- [Unrelated resource-binding shadow status is misread as graph readiness] → report it separately; it remains Legacy until its own package-level gate and explicit activation are completed.

## Migration Plan

1. Verify tag-to-package identity, local provenance/tar hash, local OCI config digest, remote all-ABSENT prestate, Authority-store emptiness, runtime artifact hashes, matching remote image config digest, and free space.
2. Create and transfer a hash-sealed transaction plan plus Authority staging bundle. Stop app and worker under an exclusive production lock.
3. Validate staged files and current runtime releases, atomically install the plan-sealed deployment script, then invoke the first-activation coordinator through the exact `v0.4.0` image.
4. Persist the committed receipt and durable cutover marker, set the deployment mode and fixed image for the app replacement, and recreate app and worker from the same image.
5. Verify containers, the four selectors, all six READY consumers, release identity, an actual read-only graph query, public health, and no mixed mode.
6. On any transaction failure before consumer commit, invoke the coordinator's identity-constrained recovery and keep consumers stopped. On an explicit rollback, stop consumers, restore Legacy service state, then remove only pointers that still match this transaction's identities.

## Open Questions

- None. The user explicitly authorized production graph cutover; the independent resource-binding and KAQ selector gates remain out of scope.
