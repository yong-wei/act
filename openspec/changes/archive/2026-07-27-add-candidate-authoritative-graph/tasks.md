## 1. Add independent candidate APIs

- [x] 1.1 Add authenticated V2 canvas and node-detail routes backed only by the candidate Repository selector.
- [x] 1.2 Preserve the existing Legacy API unchanged and add tests preventing cross-response merging or fallback.
- [x] 1.3 Add Release identity, coverage status, and projection version to candidate responses.

## 2. Build the candidate graph experience

- [x] 2.1 Render all current formal canonical types as first-class nodes with an extensible Chinese type vocabulary and generic fallback.
- [x] 2.2 Add `canonical_type` top-level navigation with one-hop heterogeneous context.
- [x] 2.3 Register and contract-test the six current predicates with Chinese names, direction, line style, and explanation; retain raw fallback only for future unregistered valid predicates.
- [x] 2.4 Add “核心” and “扩展” filters, defaulting to the combined extension view with distinct visuals.
- [x] 2.5 Add role-layered authoritative detail panels.
- [x] 2.6 Add the explicit migration-period new/old switch and state reset between APIs behind a public-activation gate that remains closed in this change.
- [x] 2.7 Display the root-locus partial-release identity, real coverage, and unavailable teaching-semantics notice.

## 3. Verify user flows

- [x] 3.1 Add API contract and component tests for types, predicates, governance filters, role fields, and no-fallback behavior.
- [x] 3.2 Run controlled browser acceptance for navigation, details, predicates, governance filters, partial-coverage messaging, and the closed public gate.
- [x] 3.3 Add a negative test proving ordinary users cannot enter candidate mode before the candidate-Konling readiness signal.
- [x] 3.4 Run targeted tests, accessibility checks, typecheck, and strict OpenSpec validation without changing formal consumers.
