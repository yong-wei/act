## Context

After domain-local fragments are available, a small set of direct cross-domain prerequisites is needed to make the overall teaching path coherent. Composition is the first point where cycles and duplicate semantics can be assessed globally.

## Goals / Non-Goals

**Goals:** publish reviewed direct cross-domain edges and validate the composed prerequisite graph.

**Non-Goals:** generate a transitive closure, force a single total course order, or block publication on incomplete coverage.

## Decisions

1. Build the review worklist from explicit domain-boundary candidates in the three accepted content increments and current course evidence.
2. Accept only direct REQUIRED or RECOMMENDED ACT_TEACHING edges. Engineering adjacency and visual boundary portals are not evidence.
3. Validate endpoint closure, deterministic identity, duplicate conflicts and the global REQUIRED-edge DAG over the full composed candidate.
4. Publish a new fragment and projection version; do not mutate the three domain-local releases.

## Risks / Trade-offs

- [A real curriculum contains alternative orders] → Model advisory alternatives as RECOMMENDED and avoid a forced total order.
- [A global cycle is discovered] → Block only the candidate projection, preserve the prior projection and return the conflicting reviewed edges to curation.

## Migration Plan

Run after all three domain content increments, review boundary candidates, compose and validate, then publish atomically. Rollback retains the last valid composed projection.
