## Why

Production must run code that understands the v2-normalized snapshot and
localized display projection before its selectors can point to v0.18. Runtime
publication therefore needs its own release action while v0.9 remains current,
so deployment compatibility is proven without combining rollout and cutover.

## What Changes

- Freeze an application revision containing the qualified v2 adapter,
  v0.18 candidate, localized projection, and Teaching Projection support.
- Verify Prisma migrations locally, build and export the production image under
  the repository release-memory gates, and bind image provenance to the frozen revision.
- Deploy the cutover-capable runtime while retaining the existing v0.9
  Authority, Teaching Projection, prerequisite, Authority domain-shard, and
  consumer-activation pointers.
- Stage and verify the sealed v0.18 candidate and rollback artifacts on the
  production host without making them current.
- Run production shadow checks for v1 compatibility, v0.18 candidate reads,
  Chinese labels, teaching queries, six consumers, worker health, and readiness.

## Capabilities

### New Capabilities

- `actkg-v018-runtime-release`: publish a cutover-capable ACT application release
  with v0.18 staged but v0.9 still selected in production.

### Modified Capabilities

- None.

## Impact

- Affects release build, image provenance, deployment preflight, remote staged
  artifacts, health checks, and release receipts.
- Depends on `qualify-actkg-v018-cutover-candidate`.
- This is the first remote deployment action in the series, but it expressly
  forbids changing the five production knowledge selectors.
