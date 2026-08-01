## 1. Recommendation provenance contract

- [x] 1.1 Add student-safe recommendation provenance types and generation helpers for candidate paths.
- [x] 1.2 Persist generation-time provenance with policy-bundle and single-path options, including explicit low-confidence fallback semantics.
- [x] 1.3 Add planner tests for evidence-to-judgment-to-resource mapping, privacy-safe fields, persistence, and low-evidence behavior.

## 2. Candidate path presentation

- [x] 2.1 Extend candidate path display mapping with a concise provenance summary and structured disclosure data.
- [x] 2.2 Render accessible recommendation-provenance disclosures and the existing evidence-review route on desktop and mobile candidate cards.
- [x] 2.3 Preserve the existing summary-only fallback for saved paths that predate provenance support.

## 3. Verification

- [x] 3.1 Add UI contract tests for traceable, low-confidence, legacy, and 320px-safe candidate path states.
- [x] 3.2 Run targeted Vitest suites, typecheck, ESLint for touched files, and `git diff --check`.
- [x] 3.3 Run the Issue worktree locally and verify the candidate-path provenance flow at desktop and 320px viewports.
