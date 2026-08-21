## Why

The Wolfram calculator now returns reliable symbolic results, but most operations expose only an original-expression checkpoint and a final result. Students need a bounded teaching-grade derivation that explains the meaningful algebraic or transform stages without asking Qwen to invent intermediate equalities.

## What Changes

- Generate operation-specific semantic derivation stages for simplify, expand, factor, partial fractions, differentiation, integration, Laplace transform, and inverse Laplace transform.
- Derive every displayed intermediate expression with Wolfram and attach an explicit verification outcome when an equivalence or transform round-trip can be checked.
- Prefer a bounded operation-specific sequence for non-trivial supported problems; recognized partial-fraction and inverse-Laplace problems include coefficient setup, equations, solution, substitution, and verification rather than collapsing coefficient solving into one step.
- Inject the ordered derivation into Konling with a teaching-answer contract that preserves step order, states the governing rule, separates the final answer, and reports verification limitations.
- Require Konling to explain every governed stage separately and prohibit compressing several verified stages into one prose jump.
- Preserve the existing calculation request/response shape and keep `calculate` unavailable to the language model.

## Capabilities

### New Capabilities

- `teaching-grade-math-derivations`: Defines governed Wolfram-generated semantic derivations, verification reporting, and Konling teaching presentation for supported symbolic operations.

### Modified Capabilities

None.

## Impact

- Affects `scripts/math-calc/calc.wls`, the real Wolfram regression suite, calculator contract tests, `src/lib/konling-math-precompute.ts`, and the AI chat precompute context.
- Depends on the in-progress `switch-konling-math-to-wolfram-precompute` change and preserves its public API, authentication, timeout, concurrency, and tool-removal behavior.
- Does not require a frontend component or database schema change; the existing chat renderer consumes the more detailed Markdown answer.
