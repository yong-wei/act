## Context

The current worktree is based on HEAD `957f367026d6d247ef79df2be081debe5c40a617` with tree `4156faab0b73ea1deaaba9e37dff0c67291e50df`. The committed architecture baseline still identifies source commit `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac`, tree `189dfeb5ad35f1d88e8ea5509a48b388424bf88f`, and 27,432 observations. That baseline remains immutable historical input; this change must not silently rewrite it.

Current source facts that motivate the delta are observations, not findings:

- `src/features/adaptive` has 10 production files and still serves route/UI composition.
- `src/features/adaptive-assessment` has 14 production files spanning catalog, selection, evidence, lifecycle, and generation/review concerns.
- `src/features/assessment` already exposes `public-api.ts`, `application/attempts.ts`, `ports.ts`, and durable attempt adapters.
- `src/lib` retains 19 production `adaptive-*`/`adaptive-planning/*` files totaling 185,917 bytes by the current tree scan.
- `src/features/personalization/path-planning/internal/assemble-plan.ts` is 250,111 bytes / 6,182 lines, and `src/features/personalization/learner-state/internal.ts` is 111,670 bytes / 2,754 lines.
- Relevant active change directories include `complete-assessment-checkpoint-resource-semantics`, `document-adaptive-attempt-diagnosis-context`, `add-konling-learning-continuity-loop`, `explain-active-path-node-decisions`, and `orchestrate-remediation-micro-tutoring`; their actual status and overlap must be re-read at capture time.

The repository already has deterministic census, receipt, privacy, charter, and fitness machinery. The delta must consume those contracts rather than create another full census, ledger, closure system, or receipt family.

## Goals / Non-Goals

**Goals:**

- Bind every observation to one clean current source identity and a declared predecessor baseline.
- Merge owner conflict, retirement, and hotspot evidence into one normalized, bounded record set.
- Preserve ambiguity, production/test distinction, active/archive distinction, and deletion conditions.
- Give C1 and later changes a reproducible denominator for consumers, deletion sets, invariants, and expected simplification measurements.

**Non-Goals:**

- Re-run or replace the historical 2026-08-26 baseline in place.
- Decide unresolved ownership silently, migrate callers, delete code, or change dependency enforcement.
- Add a new production dependency, architecture gate, database model, or runtime behavior.

## Decisions

1. **Current-head package is a delta, not a second baseline.** Record the predecessor baseline identity and only changed, newly discovered, unresolved, or migration-relevant observations. Full source-derived facts remain in the existing census machinery.
2. **One normalized record shape covers the three slices.** Each record carries a stable id, category (`owner-conflict`, `retirement`, or `hotspot`), current owner evidence, candidate target owner(s), production/test consumers, trust boundary, deletion condition, rollback reference, and repository-relative evidence. A hotspot without an ownership or retirement consequence remains an observation, not an automatic finding.
3. **Consumer evidence is import- and call-graph based.** Directory presence, an archived proposal, a closed Issue, or a stale ledger row cannot prove an active consumer or deletion safety. Static imports, dynamic loads, re-exports, route/worker/script references, and relevant tests are classified separately.
4. **Active-change conflicts are a projection.** The capture reads current non-archived OpenSpec directories and records overlapping paths, contracts, and dependencies. It does not alter those changes or treat their existence as implementation proof.
5. **Privacy and determinism follow the existing census contract.** Serialize stable repository-relative identities and bounded evidence. Exclude secrets, learner identifiers, raw payloads, media, screenshots, absolute machine paths, and complete command logs.

## Risks / Trade-offs

- [Current consumers can change while the scan runs] → Require a clean committed revision, record the exact revision/tree, and fail the qualified package on mixed worktree input.
- [A compact delta hides an unexamined full denominator] → Reconcile each category to the existing census/charter identities and link unresolved records to the source observation rather than copying the entire ledger.
- [A large file is mistaken for a defect] → Record size and complexity as prioritization evidence only; require owner and behavior evidence before a later simplification change acts.
- [Historical active-looking directories are misclassified] → Read current task/checklist status and consumer evidence; retain ambiguity or absence of proof explicitly.

## Migration Plan

1. Verify the current Git identity, predecessor baseline identity, OpenSpec inventory, and clean-worktree preconditions.
2. Run the existing architecture census/fitness readers and bounded static scans without writing product or baseline files.
3. Normalize and write the five current-head package files, then validate privacy, determinism, denominator reconciliation, and source identity.
4. Use the package as a read-only predecessor for C1 and later changes. Rollback is deletion of the unqualified package or restoration of the prior branch revision; no application or release state is touched.

## Open Questions

- Which existing census command should be the single implementation entrypoint for the delta projection, provided it can keep detailed scan output out of Git?
- Should the package live under the proposed `current-head/` directory or another repository-relative evidence directory, as long as it does not overwrite the historical baseline?
