## 1. Incremental Format

- [x] 1.1 Define immutable domain-fragment and composed-manifest schemas with Authority, evidence and digest bindings.
- [x] 1.2 Extend authoring and build tools to publish core-node memberships and direct ACT_TEACHING relations by domain.
- [x] 1.3 Translate current published teaching records into the first fragment without changing their semantics.

## 2. Composition and Gates

- [x] 2.1 Implement deterministic fragment composition and complete endpoint, duplicate and REQUIRED-edge DAG validation.
- [x] 2.2 Separate validity failures from available, partial, empty and unavailable coverage states.
- [x] 2.3 Define and validate a Teaching Projection activation identity and cache-family contract independent from Engineering Authority activation; runtime pointer and cache implementation remain deferred.

## 3. Future-Compatible Consumption

- [x] 3.1 Resolve published teaching relation presentation from the registered composition contract rather than release-specific relation lists.
- [x] 3.2 Add tests proving future valid relations enter a composed projection and incomplete coverage never blocks the artifact gate.
- [x] 3.3 Run projection tests, typecheck, data-governance checks and strict OpenSpec validation.
