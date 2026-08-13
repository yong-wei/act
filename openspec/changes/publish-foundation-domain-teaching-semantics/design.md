## Context

This change is a content-governance increment for system modeling, time-domain analysis and stability analysis. It consumes the incremental projection contract and must not change engineering facts or wait for exhaustive coverage.

## Goals / Non-Goals

**Goals:** publish reviewed core-node membership and evidence-backed direct teaching prerequisites for the three foundation domains.

**Non-Goals:** infer transitive edges, review unrelated domains, or change Authority entities and relations.

## Decisions

1. Start from current course objectives, primary teaching resources, existing reviewed cards and explicit teacher curation; Authority membership alone is not evidence of teaching order.
2. Store only direct REQUIRED or RECOMMENDED edges. Derived reachability and learning order remain runtime views.
3. Review unresolved candidates incrementally. Accepted edges publish even when other candidates remain uncovered, provided the candidate fragment is internally valid.
4. Bind every accepted record to the current Authority object, ACT evidence and fragment revision; unchanged records retain their prior evidence digest.

## Risks / Trade-offs

- [Foundation scope grows without bound] → Limit the denominator to explicitly selected core nodes.
- [Reviewers encode topic proximity as prerequisite] → Require a direct pedagogical rationale for every edge.

## Migration Plan

Create domain worklists, review candidates, publish one validated fragment and retain the prior projection for rollback.
