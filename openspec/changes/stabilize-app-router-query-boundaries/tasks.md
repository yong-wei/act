## 1. Inventory

- [ ] 1.1 Extract current App Router warning diagnostics for query, client-fetch, metadata, and server-await rules.
- [ ] 1.2 Group repeated interactive course student routes by shared runtime pattern.

## 2. Query Boundaries

- [ ] 2.1 Define a shared student route query contract for `step` and other demo parameters.
- [ ] 2.2 Refactor representative interactive student routes to avoid unbounded `useSearchParams()` reads or wrap intentional reads in Suspense.
- [ ] 2.3 Add regression tests for demo step selection and authenticated/non-authenticated student entry behavior.

## 3. Server Data And Metadata

- [ ] 3.1 Move route-owned learning entry data fetches out of client effects where the data is available server-side.
- [ ] 3.2 Add metadata helpers or explicit metadata to affected route families.
- [ ] 3.3 Parallelize independent server awaits only where redirect semantics are unchanged.
- [ ] 3.4 Preserve loading-state behavior and redirect/auth ordering when moving client fetches to server routes or parallelizing awaits.

## 4. Validation

- [ ] 4.1 Run affected route tests and focused React Doctor warning evidence.
- [ ] 4.2 Run owned-surface error and Security gates and confirm zero selected diagnostics.
- [ ] 4.3 Run `rtk openspec validate stabilize-app-router-query-boundaries --strict`.
