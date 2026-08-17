## 1. Explicit candidate comparison state

- [x] 1.1 Add typed comparison state helpers for stable candidate batch/path version keys, normalized unordered pairs, valid pair enumeration, and URL parsing.
- [x] 1.2 Replace per-card implicit `explain` state with a batch-level comparison selector and unified result region; keep existing path write actions attached to each candidate.
- [x] 1.3 Add summary and fallback rendering for zero, one, two, and three candidates, including no-material-difference and insufficient-data copy.
- [x] 1.4 Persist only confirmed comparison state in URL and clear stale state when batch, version, candidate set, or pair changes.

## 2. Server comparison contract

- [x] 2.1 Extend the path-advisor explain input/output contract with explicit selected and compared option identities and a normalized comparison key.
- [x] 2.2 Enforce same-path, same-version, different-option authorization and preserve the existing server-owned difference facts and recommendation provenance boundary.
- [x] 2.3 Add runtime and route tests for all legal two/three-candidate pairs, same-option rejection, insufficient data, no material difference, and read-only behavior.

## 3. Verification and evidence

- [x] 3.1 Add page/unit tests for URL restoration, late-response rejection, candidate-batch replacement, keyboard operation, and 320px layout contracts.
- [x] 3.2 Run targeted tests, typecheck, relevant ESLint, strict OpenSpec validation, and `git diff --check`.
- [x] 3.3 Run the Issue branch browser evidence flow at desktop and 320px widths, then record the verified behavior before opening the PR.
- [x] 3.4 Fix comparison requests when the candidate batch source path differs from the currently active path, and add a regression test for the separate read-only comparison context.
