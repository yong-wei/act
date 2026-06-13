## 1. Simulation Entry Architecture

- [x] 1.1 Make `/simulations` the canonical student-facing simulation catalog.
- [x] 1.2 Convert `/virtual-lab` into redirect-only compatibility behavior.
- [x] 1.3 Remove student-facing model deployment/status information from the primary catalog.
- [x] 1.4 Preserve existing `/simulations/*` deep links.

## 2. Navigation And Governance

- [x] 2.1 Register `/virtual-lab` compatibility redirect semantics in central navigation contracts.
- [x] 2.2 Add tests proving student navigation exposes one canonical simulation entry targeting `/simulations`.
- [x] 2.3 Add tests proving `/virtual-lab` does not expose conflicting open counts or model deployment statuses.
- [x] 2.4 Run focused tests and `rtk openspec validate unify-virtual-simulation-information-architecture --strict`.
