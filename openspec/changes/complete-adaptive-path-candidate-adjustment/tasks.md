## 1. Derived Candidate Contract

- [ ] 1.1 Define and validate the derived-batch metadata projection for source batch, source candidate, normalized request, source fingerprint, active-progress version, and difference summary.
- [ ] 1.2 Resolve adjustment sources by authorized persisted batch and candidate identity; reject ordinal-only, mismatched, or stale sources.
- [ ] 1.3 Add server-side material-difference evaluation and the explicit `no_material_difference` outcome.

## 2. Adjustment Persistence And Runtime

- [ ] 2.1 Persist materially changed revision results as new immutable candidate batches without modifying the source batch or active path.
- [ ] 2.2 Return the derived batch and candidate identities through the path-advisor result lifecycle with idempotent retry behavior.
- [ ] 2.3 Remove revision-created `switch` choice evidence and retain adjustment-specific tool-run audit.
- [ ] 2.4 Add focused tests for derived lineage, ownership, idempotency, material difference, stale progress, and active-path preservation.

## 3. Adaptive Learning Center

- [ ] 3.1 Submit adjustment from an explicitly selected persisted candidate and keep editable parameters associated with that source.
- [ ] 3.2 Load and display the authorized derived batch in the existing comparison workspace after success without hiding or mutating the current path.
- [ ] 3.3 Render student-safe states for pending, failed, stale, unavailable, and `no_material_difference` outcomes.
- [ ] 3.4 Ensure only explicit candidate selection enters the existing path-choice and execution flow.

## 4. Regression And Delivery

- [ ] 4.1 Add component, route, and browser coverage for adjustment visibility, source stability, concurrent request invalidation, explicit selection, and refresh recovery.
- [ ] 4.2 Verify existing generation, continue-current-path, candidate comparison, deep links, candidate selection, and path execution remain unchanged.
- [ ] 4.3 Run focused tests, typecheck, lint for touched code, strict OpenSpec validation, and browser acceptance at desktop and 320px widths.
