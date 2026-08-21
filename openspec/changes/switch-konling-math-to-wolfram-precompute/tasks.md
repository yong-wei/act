## 1. Wolfram calculation backend

- [x] 1.1 Add failing executor and script contract tests for `wolframscript`, 30-second timeout, one active calculation, structured errors, and held-expression validation.
- [x] 1.2 Implement `scripts/math-calc/calc.wls` with governed parsing, eight operations, LaTeX output, ordered steps, and non-zero structured failures.
- [x] 1.3 Switch `src/lib/math-calc.ts` from Python/SymPy to `wolframscript -file` while preserving request, response, and error contracts.
- [x] 1.4 Replace the real-script regression command with `scripts/tests/test-math-calc-wolfram.mjs` covering simplify, partial fractions, inverse Laplace, malformed input, and rejected non-mathematical Wolfram expressions.

## 2. Konling server-side precomputation

- [x] 2.1 Add failing tests for keyword detection, operation inference, representative expression extraction, successful precompute, and safe fallback.
- [x] 2.2 Implement `src/lib/konling-math-precompute.ts` using the shared calculator.
- [x] 2.3 Integrate precomputation into `src/app/api/ai/chat/route.ts`, inject successful results after model-message conversion, and remove `calculate` from every model tool set without overwriting existing route changes.

## 3. Runtime provisioning and verification

- [x] 3.1 Install and activate Wolfram Engine or Mathematica for the local runtime account and verify `wolframscript --version`. Wolfram Engine 15.0 is activated for the local Windows account.
- [x] 3.2 Run the focused Vitest suites, `npm run typecheck`, and the real Wolfram script regression.
- [x] 3.3 Validate the OpenSpec change strictly and inspect the final diff for unrelated modifications.
- [ ] 3.4 Manually verify the representative控灵 inverse-Laplace question completes promptly without a model `calculate` tool call; the local calculator regression is complete, but the running chat service still needs an end-to-end manual check.
