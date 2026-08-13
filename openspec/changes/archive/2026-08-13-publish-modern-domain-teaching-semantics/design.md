## Context

Discrete-time and state-space control require domain-specific teaching order that cannot be copied from the old graph or inferred from engineering relations.

## Goals / Non-Goals

**Goals:** publish reviewed direct prerequisites and core-node membership for discrete-time and state-space analysis/design.

**Non-Goals:** settle cross-domain entry edges, synthesize equivalence between continuous and discrete models, or require exhaustive coverage.

## Decisions

1. The pinned live Authority snapshot verifies the two exact Authority objects as approved and published, but catalog membership is not teaching admission. CourseCoverage records both exact IDs as `DEFER` with `authority unresolved`; without independent lesson, syllabus, or curriculum ACT admission evidence, neither enters the denominator.
2. Each domain is published as an independent empty fragment sharing one sealed two-node Authority envelope. `coreNodes`, `relations`, and `denominatorNodeIds` are empty; the exact IDs remain only in per-domain `unresolvedCoreCandidates` worklists.
3. Cross-domain entry and non-catalog/engineering boundaries remain range-level deferred/excluded notices in the bounded worklists. They carry no endpoint, direction, relation type, strength, or candidate count, and do not enter fragment, coverage published counts, or the REQUIRED graph.
4. Coverage is explicit `empty` and nonblocking: zero accepted relations and the `DEFER` candidate evidence are recorded without promoting the candidate to a teaching node.
5. Preserve exact Authority object verification while prohibiting Authority cards from independently promoting teaching membership; do not change generic composition, activation, runtime, API, frontend, or Authority membership.

## Risks / Trade-offs

- [State-space concepts overlap system modeling] → Use many-to-many domain membership and one canonical object identity.
- [Deferred boundaries make the fragment appear isolated] → Mark missing cross-domain linkage as coverage status, not a fabricated edge.

## Migration Plan

Review and publish the two modern-control domain fragments; rollback selects the previous Teaching Projection.
