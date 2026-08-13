## 1. Catalog Contract

- [ ] 1.1 Define the eight-domain and aggregate-entry schema, localized presentation fields and deterministic catalog identity.
- [ ] 1.2 Add reviewed many-to-many membership and preferred-navigation-domain authoring records bound to one Authority selection.
- [ ] 1.3 Add validators for registered domains, endpoint existence, duplicate memberships, aggregate role and prohibited product strings.

## 2. Runtime Projection

- [ ] 2.1 Generate a read-only runtime catalog and root summaries without mutating ActKG artifacts.
- [ ] 2.2 Expose presentation-only root DTOs that cannot enter Authority object or relation counts.
- [ ] 2.3 Add deterministic rebuild, Authority-drift and multi-domain identity tests.

## 3. Verification

- [ ] 3.1 Verify catalog authoring/runtime hashes, exact domain set and aggregate separation.
- [ ] 3.2 Run related unit tests, typecheck and strict OpenSpec validation.
