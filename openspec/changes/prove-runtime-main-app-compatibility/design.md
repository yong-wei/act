## Context

Runtime v2 already uses a content-addressed manifest from `origin/integration`, materializes a read-only candidate view on ECS, runs consumer smoke in the current application container, and switches the view through a lifecycle journal. Application images, however, are released from `origin/main` and are deployed through a separate image transaction. Existing first-cutover scripts still model one `integration` revision as both the Runtime and application revision, so they are unsuitable for recurring Runtime publication.

The required invariant is not identical Git SHAs. It is that the exact frozen Runtime manifest is consumed successfully by the exact current main application image, with the consumer and database contracts recorded before selection.

## Goals / Non-Goals

**Goals:**

- Preserve immutable, independently frozen main application and integration Runtime source identities.
- Produce an append-only compatibility proof from real candidate consumer execution in the current application container.
- Make the proof a selection prerequisite and bind it into lifecycle evidence without exposing it through public readiness.
- Preserve active and rollback Runtime state on all compatibility, identity, or lifecycle failures.
- Keep daily Runtime publication free of application image, database, Nginx, and systemd mutations.
- Prevent the legacy first-cutover command from silently acting as the daily Runtime deployment path.

**Non-Goals:**

- Replacing the coordinated authority/graph cutover transaction or activating a newer ActKG graph.
- Adding a second database migration system, changing course content authoring, or introducing a user-facing version selector.
- Requiring an application rebuild merely because a compatible Runtime Release is selected.
- Retrofitting compatibility proof records for historical active or rollback releases.

## Decisions

### Separate immutable identities, joined by proof

Application releases retain a complete `origin/main` revision, semantic application release version, and loaded image digest. Runtime Releases retain a complete `origin/integration` source revision and existing content-addressed Release identity. A `runtime-app-compatibility.v1` receipt binds both sets of facts to one canonical Runtime manifest and logical tree digest.

This keeps content identity, release identity, and operation evidence distinct. Requiring equal SHAs was rejected because it couples normal integration activity to application release timing and prevents independent Runtime updates without improving evidence of actual compatibility.

### Capture the application identity on ECS

The remote activator captures the running application container's immutable image ID/digest and the image's embedded full application revision. It also verifies that app and worker use the same deployed image. Operator-supplied revision flags are not accepted as proof inputs.

The receipt includes the candidate manifest identity, Runtime source revision, application revision/image digest, consumer-smoke contract version, and a canonical hash of the applied Prisma migration identities. It is written atomically under the candidate Runtime release directory before selector mutation, and its hash is copied into the active lifecycle receipt after successful activation.

This rejects an untrusted or stale caller claim while avoiding a new persistent database schema. Using a remote Git checkout as the app identity was rejected because ECS deployment runners intentionally do not carry the application repository.

### Qualify with actual candidate consumption and revalidate at selection

Candidate materialization runs the existing structured-runtime, route, media, textbook-reader and hybrid-index smoke against the candidate bind mount inside the current application container. Only a successful smoke may create the compatibility receipt. Immediately before selection, the activator re-reads the candidate manifest, proof, running image identity, application revision, migration hash, and declared consumer contract; any mismatch fails before desired or active state changes.

The proof is deliberately application-image-specific. An application image change does not invalidate the old Runtime release, but it requires a new proof before that release may be newly selected under the new image. This is stricter and more useful than carrying a stale test result across an image deployment.

### Preserve historical lifecycle semantics

Historical receipts without a compatibility proof remain inspectable and eligible for explicit legacy recovery under existing evidence rules. New v2 candidate selection always requires a v1 compatibility receipt. Lifecycle and GC protection treat the proof as immutable evidence associated with a candidate/active/rollback release; they do not reinterpret old state as newly qualified.

### Fence the legacy first-cutover entrypoint

`execute-production-runtime-cutover.sh` remains a named, explicit migration-only path for the one-time v1/v2/authority transition. Daily `npm run deploy:runtime` continues through the blob Runtime lifecycle and rejects any request that tries to reuse the migration entrypoint or derives the application image revision from the Runtime integration revision.

Rewriting the historical coordinated migration transaction is rejected here because it has a broader authority/selector scope and belongs to its existing OpenSpec program.

### Harden application deployment restart identity

The application deployment transport carries the `textbook-runtime-input-provenance` dependency used by the remote verifier. Generated systemd units pin the validated `APP_IMAGE` and knowledge deployment mode in `ExecStart`, after validating both values, so reboot cannot silently use the default legacy tag. The application entrypoint remains the sole owner of gated knowledge import and verification; remote deploy does not repeat Git-dependent commands inside the Git-free runner.

## Risks / Trade-offs

- [The current application image changes while qualification runs] → capture and re-read image/revision and migration hash under the lifecycle lock; fail before selector mutation on drift.
- [Consumer smoke omits a newly relevant reader] → version the smoke contract, store it in proof, and add direct tests for required structured, route, media and textbook consumers.
- [A compatibility receipt is corrupted or copied across releases] → canonicalize and hash the receipt, bind all manifest/application identities, and re-open it before selection.
- [Historical rollback lacks the new proof] → leave it readable and retain existing rollback procedures; do not silently mark it compatible with a new image.
- [The release worktree drifts while runtime source is frozen] → build manifests from the immutable `origin/integration` Git tree only, as the existing v2 publisher requires.

## Migration Plan

1. Add proof schema, canonicalization, remote capture, selection revalidation, and static/behavioral contract tests.
2. Validate the change locally, including an allowed main/integration SHA mismatch and rejected app/image, migration, manifest, or consumer-contract mismatches.
3. Merge the application-side changes to `main` and publish a new application release version from the merged SHA.
4. Deploy the application image from that main release, retaining the current active Runtime.
5. Freeze an `origin/integration` Runtime source revision, publish a non-selectable blob candidate, create its proof against the deployed main image, then execute the existing journaled Runtime selection and production readiness checks.
6. If qualification or activation fails, preserve the deployed application image and prior Runtime active/rollback identities. If application deployment fails, do not attempt Runtime selection.

## Open Questions

None. The receipt shape and migration hash are repository-owned implementation details, with no new operator-supplied compatibility claims.
