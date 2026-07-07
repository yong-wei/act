## Design

SAR suggestions should be treated as review candidates, not truth. The review workflow should preserve candidate provenance, trace summary, missing coverage type, reviewer decision, rationale, timestamp, and resulting ResourceNode governance effect where applicable.

## Candidate Lifecycle

Suggested candidates may move through `suggested`, `accepted`, `rejected`, `deferred`, `invalidated`, or equivalent states. Only accepted candidates may produce a governed ResourceNode or graph binding update, and that update must remain subject to existing ResourceNode permission and validation rules.

## Reviewer Scope

Teachers may review only authorized course/class/resource candidates. Administrators may review broader governance queues. Students must not see teacher-scoped candidate evidence.

## Verification Strategy

- Tests for accept, reject, defer, invalidation, authorization, and audit trail.
- Tests proving rejected/deferred candidates do not mutate ResourceNode or graph bindings.
- Tests proving accepted candidates still pass ResourceNode governance validation.
- OpenSpec strict validation.
