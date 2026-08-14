## Context

The current production application runs in explicit cutover mode with all five
knowledge selectors selecting v0.9. The application must first be upgraded to a
revision that understands v2-normalized snapshots and localized labels. This
deployment keeps v0.9 current and stages v0.18 as an inactive sealed release.

## Goals / Non-Goals

**Goals:**

- Publish one immutable application/image revision capable of serving v1 and v2 snapshots.
- Stage the qualified v0.18 release set on the production host without selecting it.
- Prove candidate shadow reads and continued v0.9 production behavior.

**Non-Goals:**

- Advancing Authority, Projection, prerequisite, or consumer pointers.
- Performing the production cutover or retiring Legacy/v0.9.
- Rebuilding an unqualified candidate during deployment.

## Decisions

### 1. Freeze build inputs before release work

The release pins a clean Git commit, tree, qualified candidate manifest,
external runtime identity, and image tag. Build and deployment receipts must
bind the same application revision and candidate hashes.

### 2. Retain the established build-memory and migration gates

Local PostgreSQL migration deployment/status is proven before remote work. The
Docker VM must expose at least 20 GiB, with the documented 24 GiB RAM / 8 GiB
swap target, and the builder receives a 12 GiB Node heap. Container Next build,
TypeScript, image export, labels, and provenance must all succeed.

### 3. Deploy code first while v0.9 remains selected

The cutover-aware refresh replaces application and worker containers but
asserts the five current selector identities remain the known v0.9 set before,
during, and after deployment. Candidate files are stored under immutable
release paths and cannot be discovered as current by directory scanning.

### 4. Prove both compatibility paths on the host

Production routes continue serving v0.9. Controlled shadow reads load the exact
v0.18 candidate and test localized labels, teaching queries, and six consumers
without changing shared selectors. Any mismatch rolls back the application
refresh while retaining sealed evidence.

### 5. Finish as a release operation, not a cutover

The receipt records the deployed OCI identity, five v0.9 selector hashes,
staged v0.18 identities, health checks, and next required operation. Docker Desktop is
closed after local build/deploy verification when no other build owns it.

## Risks / Trade-offs

- The application release can succeed while v0.18 qualification fails on the
  host; in that case v0.9 stays current and cutover remains blocked.
- Staging both release sets increases disk usage but makes rollback independent
  of network availability.

## Migration Plan

1. Freeze the intended release revision and rerun local migration/release gates.
2. Build, export, and verify the production image and provenance.
3. Stage v0.18 and refresh app/worker with v0.9 pointers unchanged.
4. Run current and candidate shadow verification; publish the deployment receipt.

## Open Questions

- The final image tag and GitHub Release version are selected from the frozen implementation revision.
