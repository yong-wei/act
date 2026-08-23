## Context

The in-progress Wolfram backend already parses expressions under a held allowlist and returns ordered steps through the shared calculator contract. Most operations currently add only an identification step and a final computation step. Konling injects those steps before model generation and does not expose `calculate` to the model.

The implementation must remain compatible with the existing five-field step shape and keep all symbolic work inside one Wolfram Cloud MCP `WolframLanguageEvaluator` call per request. See `proposal.md` and `specs/teaching-grade-math-derivations/spec.md` for the user-visible contract.

## Goals / Non-Goals

**Goals:**

- Produce stable, student-readable semantic derivations for all eight governed operations.
- Compute every displayed intermediate expression with Wolfram.
- Make verification and unresolved conditions explicit.
- Preserve the existing API and chat renderer.

**Non-Goals:**

- Expose raw `Trace`, evaluator internals, or every elementary rewrite.
- Build a general theorem prover or guarantee a fixed number of steps for every expression.
- Add a new frontend derivation component, database model, resident Wolfram kernel, or model tool call.

## Decisions

### Use curated semantic pipelines instead of evaluator traces

Each operation selects a short sequence of meaningful Wolfram transformations. Algebraic operations use combinations such as `Together`, `Cancel`, `Expand`, `Collect`, `FactorTerms`, `Factor`, and `Apart`. Calculus and transform operations add normalized forms, decompositions, standard-form matching, unsimplified computed results, simplified results, and inverse-operation verification.

Raw `Trace` was rejected because it exposes unstable evaluator detail, produces excessive output, and does not correspond to instructional reasoning.

### Preserve the existing step contract

The implementation continues to return only `step`, `description`, `operation`, `input`, and `output`. Governing rules and verification states are represented as ordinary semantic steps, for example `verify_equivalence`, `verify_derivative`, or `verify_laplace_round_trip`. This avoids API and frontend migration.

### Deduplicate semantically identical stages

A step builder compares normalized input and output strings and omits transformations that do not change the expression, except for definition, rule, final-answer, and verification stages. Step numbers are assigned after deduplication. This lets non-trivial expressions approach 6–12 steps while trivial expressions remain concise.

### Verify without overstating conditions

Algebraic operations verify with a simplified difference or ratio where appropriate. Integration verifies by differentiating the antiderivative. Laplace operations apply the inverse operation and compare the reconstructed expression. A result equal to `True` is reported as verified; any returned condition is rendered; `$Failed`, unevaluated transforms, or unresolved predicates are reported as unresolved.

### Constrain Konling to explanation, not derivation invention

The precompute context includes a numbered list containing every Wolfram step and a fixed teaching-answer instruction: preserve order, name the rule, do not add unsupported equalities, show a final-answer section, and state the verification result. This keeps Qwen responsible for pedagogy and prose while Wolfram remains authoritative for mathematics.

### Expand recognized handwritten strategies before model generation

For partial fractions, the Wolfram process constructs the governed undetermined-coefficient ansatz, clears denominators, derives coefficient equations, solves them, substitutes the solution, and verifies recombination. Inverse Laplace reuses the same coefficient derivation before standard-form matching. Product differentiation exposes factor derivatives before substitution into the product rule. Recognized exponential-substitution integrals expose the substitution variable, differential relation, transformed integral, standard antiderivative, and back-substitution.

These stages remain ordinary five-field steps. Konling may add natural-language explanation, but every displayed equality must come from the governed step list and no adjacent stages may be collapsed into a single unexplained jump.

The request detector removes trailing teaching instructions only after identifying the governed operation. Phrases such as “写出待定系数方程和详细步骤” therefore do not contaminate the extracted expression or silently disable Wolfram precomputation.

## Risks / Trade-offs

- [Some integrals and transforms remain unevaluated] → Detect unchanged Wolfram heads and return an explicit unresolved result rather than presenting a fabricated derivation.
- [Additional symbolic stages increase latency] → Execute all stages in the same process, cap generated partial-fraction coefficients at twelve, deduplicate no-op stages, and retain the existing 30-second timeout and concurrency cap.
- [A generic pipeline may not mirror a textbook's preferred method] → Use operation-specific descriptions and standard-form stages, but prioritize correct computed equalities over pretending to reproduce one canonical handwritten method.
- [Command-line JSON has an operating-system length ceiling] → The existing expression length limit keeps the bounded request far below the Windows command-line limit.

## Migration Plan

1. Add regression expectations for semantic stages and verification before changing the script.
2. Add shared step-building and verification helpers, then implement operation pipelines incrementally.
3. Strengthen the Konling precompute prompt contract without changing the response schema.
4. Run focused unit tests, real Wolfram regression cases, typecheck, strict OpenSpec validation, and the representative chat acceptance test.
5. Roll back by restoring the previous two-step Wolfram script and precompute prompt; no persisted data migration is required.
