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
- Do not implement a resident Wolfram kernel pool, bake Wolfram Engine into the app image, or expose official MCP tools directly to the chat model.
- Do not guarantee extraction of unrestricted natural-language mathematics; unsupported phrasing falls back to ordinary chat.
- Do not embed personal Wolfram activation credentials in the repository or container image.

## Decisions

### Call Wolfram Cloud MCP `WolframLanguageEvaluator` through the existing shared executor

`src/lib/math-calc.ts` remains the single execution boundary used by the API and precompute path. It wraps `scripts/math-calc/calc.wls` plus the JSON request envelope into a Wolfram Language program, then calls official Wolfram Cloud MCP at `https://agenttools.wolfram.com/mcp` with Streamable HTTP `tools/call` on `WolframLanguageEvaluator`. Timeout stays 30 seconds and active concurrency stays one, with the eight-request queue retained.

This avoids baking Wolfram Engine into the production image. The teaching-grade script remains the calculation source of truth; Cloud MCP is only the remote kernel. A local Engine/Local MCP path is out of scope.

### Parse held input and validate the Wolfram expression tree before evaluation

Direct `ToExpression` evaluation would weaken the current restricted SymPy parser because allowed characters can still form Wolfram Language calls such as filesystem or environment inspection. The script therefore calls `ToExpression` with `HoldComplete`, validates symbols and expression heads against a mathematical allowlist, and only then releases the expression for calculation. LaTeX-marked input uses `TeXForm`; plain input uses normal Wolfram syntax after narrow normalization for common implicit multiplication and function names. Parser modes do not fall back into each other.

This preserves the requested Wolfram parsing behavior without turning the calculator into a general Wolfram code execution endpoint.

### Keep detection and computation separate

`detectMathRequest` owns keyword detection and expression extraction. `inferOperation` owns the ordered mapping to the eight governed operations, with inverse Laplace checked before Laplace. `precomputeMathAnswer` composes them with `runMathCalculate` and returns `null` for unsupported input, structured calculation failures, capacity errors, or runtime unavailability.

The detector normalizes common Unicode operators, strips display delimiters, removes a leading assignment label such as `F(s)=`, and inserts only unambiguous multiplication needed by common control expressions. It does not attempt general natural-language parsing.

### Inject trusted context after message conversion and omit only calculate

The route computes from the latest effective user message after conversation/runtime message reconciliation. A successful result is appended to the converted model messages as a server-authored system context instructing the model to explain the supplied result rather than invent a replacement. This is appended after the existing historical-system-message filter, preserving the unrelated working-tree change.

Before `streamText`, the route creates a new tool object without `calculate` for every request. Other scoped tools remain available. Model capability requirements are recomputed from the resulting tool set so ordinary requests without remaining tools do not require provider tool support.

### Treat Wolfram Cloud MCP as a runtime network dependency

The production runner does not copy Wolfram Engine. It needs outbound HTTPS to `agenttools.wolfram.com` (overridable with `WOLFRAM_CLOUD_MCP_URL`). Official Cloud MCP is unauthenticated; an optional Bearer token is only for a paid MCP Service endpoint. `docker-entrypoint.sh` runs a real Cloud MCP `calc.wls` smoke before migrations and exits non-zero when the endpoint is unreachable or the script cannot return structured JSON. Scanner/GC loops set `SKIP_WOLFRAM_READY_CHECK=1` so they do not re-probe the cloud calculator every interval.

## Risks / Trade-offs

- [Wolfram cold start exceeds normal chat latency] → Use a 30-second hard timeout, one active process, and precompute only detected requests.
- [Natural-language extraction selects the wrong substring] → Keep extraction conservative; schema validation or calculator failure returns `null` and ordinary chat continues.
- [Direct Wolfram parsing enables arbitrary evaluation] → Parse under `HoldComplete`, validate the full expression tree, and reject non-mathematical heads before release.
- [Wolfram Cloud MCP is unreachable] → Fail closed at deploy/startup; keep the 30-second timeout and one in-flight calculation.
- [Official Cloud MCP is unauthenticated] → Send only the already-allowlisted `calc.wls` program; never forward raw student chat.
- [Removing model calculation changes generic-chat tool behavior] → Preserve the direct authenticated API and inject equivalent trusted results before generation.
- [Existing tests and deployment probes assume Python/SymPy] → Replace only math-backend-specific assertions; leave unrelated Python dependencies intact.

## Migration Plan

1. Point the runner at Wolfram Cloud MCP and confirm outbound HTTPS plus a real `calc.wls` smoke.
2. Deploy the Wolfram script, Cloud MCP executor, precompute helper, route integration, and fail-closed readiness check together.
3. Run direct simplify, partial-fraction, and inverse-Laplace smoke tests, then related unit tests and typecheck.
4. Verify a representative控灵 inverse-Laplace question completes without a model `calculate` tool call.
5. Roll back by reverting this change and restoring the prior calculator backend if Wolfram Cloud MCP cannot be sustained.
