## Purpose

Define student-facing symbolic derivations whose intermediate expressions are computed and checked by Wolfram, then explained by Konling without inventing unsupported algebraic steps.

## ADDED Requirements

### Requirement: Supported operations return semantic teaching steps
The calculator SHALL return ordered, operation-specific teaching steps for simplify, expand, factor, partial fractions, differentiation, integration, Laplace transform, and inverse Laplace transform. Each displayed intermediate expression SHALL be produced by the governed calculator rather than authored by the language model.

#### Scenario: Non-trivial operation has a recognized teaching strategy
- **WHEN** a supported non-trivial expression matches an operation-specific derivation strategy
- **THEN** the calculator SHALL return a bounded sequence covering the governing rule, material intermediate expressions, final result, and verification where available
- **AND** it SHALL NOT expose Wolfram kernel trace output.

#### Scenario: Partial fractions require coefficient solving
- **WHEN** a governed rational expression has a polynomial denominator that can be decomposed with at most twelve undetermined coefficients
- **THEN** the derivation SHALL show the partial-fraction ansatz, denominator clearing, coefficient equations, coefficient solution, and substitution
- **AND** inverse-Laplace derivations SHALL reuse these stages before matching standard transform pairs.

#### Scenario: Recognized calculus rule has material substeps
- **WHEN** differentiation uses a product rule or integration matches the governed exponential-substitution strategy
- **THEN** the derivation SHALL expose factor derivatives or the substitution, differential, rewritten integral, standard antiderivative, and back-substitution as applicable.

#### Scenario: Expression is trivial or no detailed strategy applies
- **WHEN** the expression can be solved in fewer meaningful stages or no specialized derivation strategy applies
- **THEN** the calculator SHALL return the accurate stages it can establish
- **AND** it SHALL NOT repeat, fabricate, or split equivalent statements merely to reach a step count.

### Requirement: Derivation verification is explicit
The calculator SHALL add an ordered verification step when it can check algebraic equivalence, differentiation of an antiderivative, or a forward/reverse transform round trip. The verification step SHALL distinguish a proven identity from a conditional or unresolved result.

#### Scenario: Algebraic result can be verified
- **WHEN** Wolfram proves the original and reconstructed expressions equivalent
- **THEN** the derivation SHALL include a verification step whose output states that the identity is verified.

#### Scenario: Verification depends on assumptions or cannot be resolved
- **WHEN** verification returns conditions or does not reduce to a proved identity
- **THEN** the derivation SHALL report the condition or unresolved status
- **AND** Konling SHALL NOT describe the result as unconditionally verified.

### Requirement: Konling presents the governed derivation as a teaching answer
For a successful precomputed calculation, Konling SHALL receive the ordered Wolfram derivation with instructions to preserve its order, explain the governing rule for each stage, separate the final answer, and report the verification conclusion.

#### Scenario: Detailed derivation is injected before generation
- **WHEN** server-side precomputation returns a successful teaching derivation
- **THEN** the model context SHALL contain every ordered step and the final result
- **AND** it SHALL instruct the model not to introduce unsupported equalities, omit a material intermediate stage, or compress multiple governed stages into one prose jump.

#### Scenario: User appends a request for detailed work
- **WHEN** a governed expression and operation are followed by a teaching request such as asking for coefficient equations or detailed steps
- **THEN** the detector SHALL extract only the mathematical expression
- **AND** the trailing teaching request SHALL NOT disable Wolfram precomputation or fall back to unverified model calculation.

#### Scenario: Model generation receives a partial but accurate derivation
- **WHEN** the calculator returns fewer than six meaningful steps
- **THEN** Konling SHALL explain those available steps accurately
- **AND** it SHALL NOT invent additional derivation stages to satisfy a presentation target.

### Requirement: Detailed derivations preserve runtime bounds and safety
Teaching-grade derivations SHALL execute within the existing governed Wolfram process, parsing allowlist, 30-second timeout, concurrency limit, and stable error projection. The language model SHALL remain unable to invoke `calculate` directly.

#### Scenario: Detailed derivation exceeds the process timeout
- **WHEN** a teaching derivation does not complete within the governed timeout
- **THEN** the executor SHALL terminate the Wolfram process and return the existing timeout response
- **AND** no partial unverified derivation SHALL be presented as a completed answer.

#### Scenario: Unsafe expression is submitted
- **WHEN** an expression contains a rejected Wolfram structure
- **THEN** the calculator SHALL reject it before evaluation
- **AND** detailed-step generation SHALL NOT weaken the expression allowlist.
