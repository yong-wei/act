## 1. Wolfram calculation backend

- [x] 1.1 Add failing executor and script contract tests for Wolfram Cloud MCP, 30-second timeout, one active calculation, structured errors, and held-expression validation.
- [x] 1.2 Implement `scripts/math-calc/calc.wls` with governed parsing, eight operations, LaTeX output, ordered steps, and non-zero structured failures.
- [x] 1.3 Switch `src/lib/math-calc.ts` from Python/SymPy to Wolfram Cloud MCP `WolframLanguageEvaluator` while preserving request, response, and error contracts.
- [x] 1.4 Replace the real-script regression command with `scripts/tests/test-math-calc-wolfram.mjs` covering simplify, partial fractions, inverse Laplace, malformed input, and rejected non-mathematical Wolfram expressions.

## 2. Konling server-side precomputation

- [x] 2.1 Add failing tests for keyword detection, operation inference, representative expression extraction, successful precompute, and safe fallback.
- [x] 2.2 Implement `src/lib/konling-math-precompute.ts` using the shared calculator.
- [x] 2.3 Integrate precomputation into `src/app/api/ai/chat/route.ts`, inject successful results after model-message conversion, and remove `calculate` from every model tool set without overwriting existing route changes.

## 3. Runtime provisioning and verification

- [x] 3.1 Point production at official Wolfram Cloud MCP (`https://agenttools.wolfram.com/mcp`), remove the baked-in Wolfram Engine image path, and fail closed when Cloud MCP is unreachable or cannot execute `calc.wls`.
- [x] 3.2 Run the focused Vitest suites, `npm run typecheck`, and the real Wolfram script regression.
- [x] 3.3 Validate the OpenSpec change strictly and inspect the final diff for unrelated modifications.
- [x] 3.4 Manually verify the representative控灵 inverse-Laplace question completes promptly without a model `calculate` tool call. Local HTTP E2E against `http://127.0.0.1:3001` with the demo student session passed; evidence is `artifacts/konling-math-http-e2e.json`.
