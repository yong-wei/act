## 1. Fail-closed contract tests

- [x] 1.1 Add tests that a misclassified normative-risk question still becomes `verification-required` without a server-verified official citation.
- [x] 1.2 Cover standard identifiers, regulations, certifications, official limits, and must/must-not language, plus a negative general-concept “标准” example.
- [x] 1.3 Prove client-marked verified citations, prompt-injected source claims, and unofficial resolvers cannot raise the gate to `verified`.

## 2. Independent runtime gate

- [x] 2.1 Add an independent normative-risk detector used by the study-question contract, not by the primary intent classifier.
- [x] 2.2 Keep `verified` limited to existing server-verified official-reference citations.
- [x] 2.3 Update the system prompt so `verification-required` names the evidence gap, answerable boundary, and verification suggestion, while still allowing general-principle explanation.

## 3. Verification

- [x] 3.1 Assert Citation Guard exposes `normative-guidance-verification-required` for the degraded contract.
- [x] 3.2 Run focused runtime and prompt tests plus `openspec validate add-konling-normative-fail-closed-gate --strict`.
