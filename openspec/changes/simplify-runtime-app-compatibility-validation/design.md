## Context

The Runtime activator already selects a materialized candidate, restarts the application with its read-only Runtime bind, waits for `/api/readyz`, and runs the application container's structured Runtime, route, media, textbook, hybrid-index, and knowledge consumers. A second mechanism writes a content-addressed compatibility receipt containing application revision, image digest, migration digest, and a static consumer-contract name. It is a proxy for compatibility rather than the compatibility test itself.

## Goals / Non-Goals

**Goals:**

- Make the actual consumer smoke the only application/Runtime compatibility gate.
- Keep immutable Runtime manifests, read-only mounting, lifecycle locking, selection rollback, and public readiness behavior intact.
- Allow a later application revision to consume an unchanged, internally coherent Runtime without rebuilding Runtime artifacts.

**Non-Goals:**

- Do not change Runtime blob integrity, graph selector atomicity, database migration execution, or OSS access controls.
- Do not introduce a replacement contract digest, compatibility registry, version matrix, or additional receipt.

## Decisions

1. **Use the existing actual consumer smoke as the gate.** The activator selects the candidate for the already deployed application, restarts the app and worker, requires readiness, then executes its existing in-container consumer smoke and media resolver smoke. This tests the code that consumes the mount rather than inferring compatibility from Git or image identity.

2. **Delete proxy gates.** Deployment no longer compares Runtime `authoringRevision` with the application commit, reads an application Git snapshot as a Runtime baseline, captures migration/image identities, or writes/revalidates a compatibility-proof file. Runtime source revision remains part of the immutable manifest and `authoringRevision` remains source provenance.

3. **Keep failure recovery unchanged.** A failed readiness or consumer smoke remains inside the existing activation error path and restores the previous Runtime and application image before the active lifecycle state is committed.

4. **Read legacy receipts during transition, write none.** Existing active receipts that still contain a compatibility projection remain readable solely until the next successful Runtime selection. New lifecycle and active receipts omit it; no historical proof is copied or regenerated.

## Risks / Trade-offs

- [A smoke misses a future consumer] → Keep the smoke close to actual application loaders and add a focused smoke only when a new Runtime consumer is introduced.
- [A candidate fails after its temporary selection] → Existing locked rollback restores the prior Runtime and application before active state is committed.
- [A legacy receipt contains removed fields] → Readers accept it as historical data during transition but do not expose or depend on it.

## Migration Plan

1. Remove receipt creation, revalidation, lifecycle projection, and source-revision proxy checks.
2. Make receipt readers tolerate historical compatibility fields and stop writing them.
3. Validate the activation path with an application revision different from the Runtime provenance and with a failing consumer smoke rollback.
4. Deploy the new application, stage the existing Runtime candidate, and let the actual consumer smoke decide selection.
