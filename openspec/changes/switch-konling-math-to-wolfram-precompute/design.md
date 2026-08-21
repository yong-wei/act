## Context

The current shared executor spawns `scripts/math-calc/calc.py`, and generic-chat exposes a governed `calculate` tool to the language model. The archived capability spec makes SymPy, four concurrent workers, and model-initiated calculation normative. This change replaces those constraints while preserving the public API envelope and existing authorization/error projection.

The working tree already contains an unrelated change in `src/app/api/ai/chat/route.ts` that filters historical system messages before model generation. The integration must preserve that behavior.

## Goals / Non-Goals

**Goals:**

- Keep the existing calculation request and response types stable.
- Make Wolfram evaluation deterministic, bounded, and resistant to arbitrary Wolfram Language execution.
- Precompute supported math questions before calling Qwen3.5 and pass the result as trusted context.
- Preserve all non-`calculate` tool permissions and ordinary chat behavior.

**Non-Goals:**

- Do not change the chat UI or `/api/math/calculate` client contract.
- Do not implement a resident Wolfram kernel pool or a new calculation microservice.
- Do not guarantee extraction of unrestricted natural-language mathematics; unsupported phrasing falls back to ordinary chat.
- Do not embed personal Wolfram activation credentials in the repository or container image.

## Decisions

### Spawn `wolframscript -file` through the existing shared executor

`src/lib/math-calc.ts` remains the single execution boundary used by the API and precompute path. It spawns `wolframscript -file scripts/math-calc/calc.wls`, passes the existing JSON request envelope as a bounded command-line argument on Windows (where `-file` consumes standard input), reads the JSON response from stdout, increases the timeout to 30 seconds, and reduces active concurrency to one while retaining the eight-request queue.

Keeping the shared executor avoids HTTP loopback and preserves existing route error handling. A resident kernel would reduce cold-start latency but adds lifecycle, isolation, and licensing complexity outside this change.

### Parse held input and validate the Wolfram expression tree before evaluation

Direct `ToExpression` evaluation would weaken the current restricted SymPy parser because allowed characters can still form Wolfram Language calls such as filesystem or environment inspection. The script therefore calls `ToExpression` with `HoldComplete`, validates symbols and expression heads against a mathematical allowlist, and only then releases the expression for calculation. LaTeX-marked input uses `TeXForm`; plain input uses normal Wolfram syntax after narrow normalization for common implicit multiplication and function names. Parser modes do not fall back into each other.

This preserves the requested Wolfram parsing behavior without turning the calculator into a general Wolfram code execution endpoint.

### Keep detection and computation separate

`detectMathRequest` owns keyword detection and expression extraction. `inferOperation` owns the ordered mapping to the eight governed operations, with inverse Laplace checked before Laplace. `precomputeMathAnswer` composes them with `runMathCalculate` and returns `null` for unsupported input, structured calculation failures, capacity errors, or runtime unavailability.

The detector normalizes common Unicode operators, strips display delimiters, removes a leading assignment label such as `F(s)=`, and inserts only unambiguous multiplication needed by common control expressions. It does not attempt general natural-language parsing.

### Inject trusted context after message conversion and omit only calculate

The route computes from the latest effective user message after conversation/runtime message reconciliation. A successful result is appended to the converted model messages as a server-authored system context instructing the model to explain the supplied result rather than invent a replacement. This is appended after the existing historical-system-message filter, preserving the unrelated working-tree change.

Before `streamText`, the route creates a new tool object without `calculate` for every request. Other scoped tools remain available. Model capability requirements are recomputed from the resulting tool set so ordinary requests without remaining tools do not require provider tool support.

### Treat installation and activation as an environment prerequisite

The repository supplies smoke tests and explicit verification commands but does not store activation material. Workstations or servers install Wolfram Engine/Mathematica and activate it under the runtime account. Missing or inactive runtimes fail through the stable unavailable boundary.

## Risks / Trade-offs

- [Wolfram cold start exceeds normal chat latency] → Use a 30-second hard timeout, one active process, and precompute only detected requests.
- [Natural-language extraction selects the wrong substring] → Keep extraction conservative; schema validation or calculator failure returns `null` and ordinary chat continues.
- [Direct Wolfram parsing enables arbitrary evaluation] → Parse under `HoldComplete`, validate the full expression tree, and reject non-mathematical heads before release.
- [Wolfram licensing differs across environments] → Require explicit environment provisioning and never bake personal activation credentials into source control.
- [Removing model calculation changes generic-chat tool behavior] → Preserve the direct authenticated API and inject equivalent trusted results before generation.
- [Existing tests and deployment probes assume Python/SymPy] → Replace only math-backend-specific assertions; leave unrelated Python dependencies intact.

## Migration Plan

1. Install Wolfram Engine or Mathematica and activate `wolframscript` for the application runtime account.
2. Deploy the Wolfram script, shared executor switch, precompute helper, and route integration together.
3. Run direct simplify, partial-fraction, and inverse-Laplace smoke tests, then related unit tests and typecheck.
4. Verify a representative控灵 inverse-Laplace question completes without a model `calculate` tool call.
5. Roll back by reverting this change and restoring the prior SymPy runtime dependencies if Wolfram provisioning cannot be sustained.
