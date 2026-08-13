## Context

The planner currently produces multiple ordered options inside `AdaptiveLearningPathPlan.policyBundle.paths`. Persistence serializes that entire plan into one mutable `LearningPath`; the path center derives transient `path-option-N` identifiers, and the generation tool returns no durable result identity. `LearningPath` also owns selection, execution, deviations, and terminal validation, so replacing it whenever generation succeeds would destroy active-path continuity.

Issue 1140 phase B needs a durable result shared by Konling and the path center while preserving the planner's output and the existing comparison and choice flows.

## Goals / Non-Goals

**Goals:**
- Persist every successful generation as one immutable batch with stable candidate identifiers.
- Bind the batch to learner, goal, generation request, planner output, and creation order.
- Let authorized consumers read the latest successful batch, a specific batch, or a candidate within it.
- Keep the current selected or executing `LearningPath` unchanged when a newer batch is generated.
- Reuse the existing comparison rendering and choices endpoint.

**Non-Goals:**
- Natural-language candidate matching or selection from Konling; that belongs to phase C.
- Reordering, rewriting, or independently generating planner candidates.
- Automatically starting path execution after selection.
- Redesigning the comparison workspace.

## Decisions

### Store batches separately from `LearningPath`

Add `AdaptivePathCandidateBatch` and `AdaptivePathCandidate` records. A batch stores ownership, goal, generation request identity, planner version, source path/plan reference, status, and timestamps. Each candidate stores a stable ID, ordinal, planner style/policy identity, and an immutable JSON snapshot of the candidate payload.

Using separate records prevents a newly generated result from mutating the selected path. Embedding batch history in `LearningPath.pathPayload` was rejected because that payload is intentionally mutable during choice and execution and cannot represent several generations without conflating ownership.

### Derive stable IDs at persistence time

The batch ID is derived from the server-owned generation request identity or stored behind a unique generation request key. Candidate IDs are persisted once and returned by APIs; clients never reconstruct identity from title, ordinal, or style label. The ordinal remains presentation metadata only.

### Persist only terminal successful generation output

Candidate persistence occurs after the planner result has reached the explicit successful state. Pending, running, awaiting approval, blocked, transport-unknown, and failed requests do not create successful batches. Retrying the same `generationRequestId` returns the existing batch and candidates without duplication.

### Keep candidate snapshots immutable

After a batch succeeds, candidate rows are not updated. Selection records the chosen candidate identity on the existing path-choice flow and adopts its executable payload into `LearningPath`; it does not mutate the candidate. This preserves an auditable comparison even after execution progresses.

### Add batch-aware reads without changing the current-path contract

An authorized candidate-batch API supports latest-by-user-and-goal and exact batch reads. The existing latest-path API continues to prioritize active, fallback, and completed `LearningPath` records. The page loads both independently: current path for continuity, candidate batch for comparison.

### Use URL identity for deep links

The path center accepts `batch=<batchId>` and optional `candidate=<candidateId>`. A valid candidate focuses the existing comparison row; an invalid or unauthorized identity fails closed. A focused view keeps a visible action that removes only `candidate` and shows the full batch comparison.

## Risks / Trade-offs

- **Duplicate generation retries could create duplicate batches** -> Enforce a unique generation request identity and perform creation transactionally.
- **JSON candidate snapshots could drift from current planner types** -> Store schema/planner versions and decode through a single server projection before returning student-visible data.
- **Selection could reference a candidate from another batch or learner** -> Resolve candidate ownership server-side and require the batch/path learner and goal to match before using the choices endpoint.
- **A new batch could visually hide an executing path** -> Render current-path state independently and label comparison as the latest generated alternatives.
- **Migration adds tables to a production path** -> Use additive nullable relations and indexes; no backfill is required because legacy paths remain readable and new batches begin with post-migration generations.

## Migration Plan

1. Add candidate batch and candidate tables with ownership and uniqueness constraints.
2. Deploy read/write code while retaining all existing `LearningPath` reads.
3. Begin writing batches only for successful post-deployment generations.
4. Roll back application code without dropping tables if needed; legacy path behavior remains intact.

## Open Questions

None for phase B. Phase C will define natural-language candidate resolution using these persisted identities.
