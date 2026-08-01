## 1. Aggregate recommendation basis contract

- [x] 1.1 Add student-safe aggregate recommendation basis types and generation helpers for candidate paths.
- [x] 1.2 Persist generation-time aggregate basis with policy-bundle and single-path options, including explicit low-confidence fallback semantics.
- [x] 1.3 Add planner tests for aggregate-state-to-judgment-to-resource mapping, privacy-safe fields, persistence, mixed-confidence downgrade, and low-evidence behavior.

## 2. Candidate path presentation

- [x] 2.1 Extend candidate path display mapping with a concise provenance summary and structured disclosure data.
- [x] 2.2 Render accessible recommendation-provenance disclosures and the existing evidence-review route on desktop and mobile candidate cards.
- [x] 2.3 Preserve the existing summary-only fallback for saved paths that predate provenance support.

## 3. Verification

- [x] 3.1 Add UI contract tests for sufficient aggregate evidence, low-confidence, legacy, keyboard disclosure, governed evidence link, and 320px-safe candidate path states.
- [x] 3.2 Run targeted Vitest suites, typecheck, ESLint for touched files, and `git diff --check`.
- [x] 3.3 Run the Issue worktree locally and generate fail-closed Playwright evidence for desktop and 320px candidate-path states.

## Follow-up scope outside this change

- Explain recommendation basis on active-path nodes.
- Explain why nodes were selected, advanced, delayed, or locked.
- Add event-level evidence references and governed return targets.
