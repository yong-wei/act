## 1. Teaching derivation contracts

- [x] 1.1 Extend calculator contract and real-script regression tests with expected semantic stages, no-op deduplication, verification steps, and representative 6–12-step inverse-Laplace coverage; verify the new expectations fail against the current script.
- [x] 1.2 Add Konling precompute-context tests requiring ordered step preservation, governing-rule explanations, final-answer separation, verification reporting, and prohibition on invented equalities; verify the new expectations fail before prompt changes.

## 2. Wolfram semantic pipelines

- [x] 2.1 Implement shared step construction, deduplication, renumbering, unresolved-result detection, and verification rendering in `calc.wls`; verify calculator contract tests pass.
- [x] 2.2 Implement teaching pipelines for simplify, expand, factor, and partial fractions with algebraic equivalence checks; verify focused real Wolfram cases pass.
- [x] 2.3 Implement teaching pipelines for differentiation and integration with rule/normalization stages and derivative-based verification; verify focused real Wolfram cases pass.
- [x] 2.4 Implement teaching pipelines for Laplace and inverse Laplace transforms with decomposition, standard-form stages, and round-trip verification; verify the representative inverse-Laplace case returns meaningful ordered stages within 30 seconds.
- [x] 2.5 Expand governed partial fractions into an ansatz, cleared-denominator identity, coefficient equations, solved coefficients, and substitution; reuse the stages in inverse Laplace and verify real Wolfram regressions.
- [x] 2.6 Expand product differentiation and recognized exponential-substitution integration into material handwritten substeps; verify real Wolfram regressions and derivative checks.

## 3. Konling teaching presentation

- [x] 3.1 Strengthen the server-injected math context so Qwen preserves every Wolfram stage, explains its rule, separates final answer and verification, and does not invent missing steps; verify focused chat-route and precompute tests pass.
- [x] 3.2 Preserve safe fallback, tool removal, timeout, concurrency, and error projection behavior; verify the existing math executor and Konling runtime suites remain green.
- [x] 3.3 Require Konling to explain every governed stage separately, allow prose-only elaboration, and label Wolfram-computed or verified mathematics without permitting new equalities.
- [x] 3.4 Preserve Wolfram precomputation when users append requests for coefficient equations or detailed work; verify the representative suffixed question no longer falls back to model-only calculation.

## 4. Verification and acceptance

- [x] 4.1 Run `node scripts/tests/test-math-calc-wolfram.mjs`, the focused Vitest suites, `npm run typecheck`, strict OpenSpec validation, and `git diff --check` with no failures.
- [x] 4.2 Re-run the real Wolfram regression, focused Vitest suites, typecheck, strict OpenSpec validation, and diff checks after the no-jump remediation.
- [x] 4.3 Manually compare governed and non-tool answers in Konling and verify the governed answer contains the full coefficient derivation, final answer, and verification without a model `calculate` tool call.
