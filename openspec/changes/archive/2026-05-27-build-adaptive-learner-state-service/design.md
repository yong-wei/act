## Context

The report says the existing six-dimensional profile is useful but too coarse for path planning. The learner state service should preserve that high-level model while adding quantified second-level state, knowledge mastery, resource preference, media absorption, and confidence metadata.

## Decisions

### Use governed evidence as the input boundary

Learner state reads governed facts, snapshots, profile summaries, assessment records, feature cache payloads, path feedback, and prerequisite-provided simulation/Arena feature groups. Raw source tables remain audit and drilldown inputs, not normal request-time profile computation.

### Declare quantification contracts

Each learner-state field must declare value range, source families, algorithm version, evidence threshold, confidence policy, fallback reason, and privacy scope. This prevents unrelated low-confidence signals from being treated as equivalent to high-confidence assessment-backed mastery.

### Treat client profile values as hints

AI and path endpoints may accept client hints for UX continuity, but authoritative adaptive state comes from the server service.

## Risks / Trade-offs

- A broad learner state can become a dumping ground; field families must stay tied to declared consumers and privacy scope.
- Some state will be low confidence until upstream evidence improves; fallback reasons must be explicit.

## Migration Plan

1. Extend feature-cache payloads and versioning.
2. Add learner-state read APIs behind a feature flag.
3. Update profile, path-planner, personalization, and Konling consumers gradually.
4. Keep old profile routes compatible.

## Open Questions

- None.
