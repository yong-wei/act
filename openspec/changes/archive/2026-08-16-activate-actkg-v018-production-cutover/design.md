## Context

Runtime publication leaves production on the complete v0.9 release set. The
final operation must select the already staged v0.18 Authority, Teaching
Projection, prerequisites, composed Authority domain shards, and shared
consumer manifest as one recoverable transaction. The existing consumer
pointer remains the READY commit point.

## Goals / Non-Goals

**Goals:**

- Atomically select the exact qualified v0.18 release set in production.
- Verify all six consumers and user-facing localized graph behavior.
- Restore the complete v0.9 predecessor on any failed post-switch observation.

**Non-Goals:**

- Importing or rebuilding a candidate during cutover.
- Retiring Legacy, deleting v0.9, or rewriting historical receipts.
- Switching only one consumer or one knowledge pointer.

## Decisions

### 1. Revalidate the immutable handoff immediately before locking

The operator bundle pins the deployed application OCI identity, qualification
receipt, v0.18 target identities, v0.9 predecessor identities, current
production marker, and all expected pointer hashes. Drift blocks transaction entry.

### 2. Use the existing five-selector write-ahead protocol

Under one exclusive host lock, the operation writes and re-reads a sealed
journal, performs comparison checks, stages atomic replacements, and advances
Authority, Teaching Projection, prerequisite, Authority domain-shard, then
shared consumer activation. The consumer pointer is the only READY commit point.

### 3. Preserve an identity-constrained v0.9 rollback

Before the forward switch, the operation exercises rollback against the staged
release set. After transaction entry, compensation may restore only pointers
whose current identities match the journaled v0.18 targets. Concurrent drift
stops compensation and produces a blocked recovery state.

### 4. Verify production semantics after the commit point

Post-switch checks cover pointer and receipt closure, 6,843 visible nodes,
2,811 relations, localized preferred/fallback labels, no learner-visible system
identifiers, teaching queries, cards/infographs, prerequisites, graph/RAG,
Konling, course runtime, learning paths, worker health, and public readiness.

### 5. Keep the predecessor after success

The v0.9 release set, rollback manifest, and historical Legacy view remain
available. Retirement requires a later observation window and separate change.

## Risks / Trade-offs

- A committed switch followed by a failed semantic check causes a second atomic
  transaction back to v0.9; this is safer than leaving mixed state.
- Service observation has bounded timing, so the receipt records each endpoint
  and consumer result rather than only a global health flag.

## Migration Plan

1. Verify the deployed runtime, qualification receipt, targets, predecessors, and lock state.
2. Exercise rollback and enter the sealed write-ahead transaction.
3. Advance five selectors and commit through shared consumer activation.
4. Run production verification; compensate to v0.9 on failure.
5. Seal the cutover or rollback receipt and retain both release sets.

## Open Questions

- The observation-window duration for later v0.9 retirement is outside this change.
