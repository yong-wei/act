## 1. Frozen normative regression set

- [x] 1.1 Create `src/lib/konling-normative-status-cases.json` with standard, implicit, multi-intent, standard-identifier, and obligation phrasings expecting `verification-required`, plus negative course-vocabulary cases expecting `not-applicable`.
- [x] 1.2 Add contract-level tests computing the normative status confusion matrix over the frozen set with accuracy ≥90% and `verification-required` recall ≥90%, and negative cases never gated.

## 2. Detection parity

- [x] 2.1 Extract a shared normative keyword list used by both the generic intent classifier and the independent normative-risk detector.
- [x] 2.2 Add a regression test that a standard-phrased normative question still enters `verification-required` under a non-generic mode whose answer intent falls back to `fact-explanation`.

## 3. Answer-level deterministic gate

- [x] 3.1 Extend `KonlingCitationGuard` with optional `normativeCompliance` and compute it inside `buildKonlingCitationGuard` when `normativeGuidance` is `verification-required` and an assistant message is available.
- [x] 3.2 Implement `applyKonlingNormativeSafetyDegradation` that replaces a non-compliant final answer with the server-owned degraded template and passes compliant or non-gated answers through unchanged.
- [x] 3.3 Wire the degradation into the chat route final guard outcome and the session messages route guard post-processing, and expose `normativeCompliance` in both metadata payloads.
- [x] 3.4 Add one sentence to the `verification-required` prompt line stating that non-compliant answers are replaced by the system.

## 4. Verification

- [x] 4.1 Unit tests: canned non-compliant answers (official-must assertions, fabricated standard identifiers, authority links) degrade to zero unsafe assertions; compliant answers and the `verified` path pass through unchanged; client self-verified claims cannot raise the gate.
- [x] 4.2 Route wiring source assertions for both delivery routes, following the existing runtime-guard test precedent.
- [x] 4.3 Run `npm run typecheck`, the new tests, and the existing konling runtime/intent/blind-audit test files; confirm zero new failures against the parent-commit baseline.
