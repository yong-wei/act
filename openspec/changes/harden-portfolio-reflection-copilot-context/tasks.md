## 1. Server task-contract boundary

- [x] 1.1 Add a bounded `auditTaskContext` input type and server parser for portfolio-reflection requests, deriving output and writeback semantics from the existing task contract.
- [x] 1.2 Add a server-generated prompt section that communicates reflection intent and candidate-only writeback rules without exposing raw request or internal runtime fields.

## 2. Copilot and route integration

- [x] 2.1 Add the validated task descriptor to the portfolio-reflection Copilot request body while leaving evidence and general chat bodies unchanged.
- [x] 2.2 Parse the descriptor at `/api/ai/chat`, reject invalid present values with a safe 400 response, and append the resolved contract only to the private system prompt.

## 3. Regression coverage

- [x] 3.1 Add unit tests for valid reflection normalization, server-owned output/writeback mapping, malformed input rejection, and internal-field exclusion.
- [x] 3.2 Extend route and Copilot source-contract tests to prove the descriptor reaches the API boundary and that general/evidence behavior remains compatible.
- [x] 3.3 Run focused tests, TypeScript checks, strict OpenSpec validation, and `git diff --check`; run the available browser smoke for the Copilot route.

Verification note: focused Vitest coverage passed (37 tests); both strict OpenSpec validations passed; and `git diff --check` passed. The full repository typecheck was run but remains blocked by pre-existing integration errors in missing control-engine WASM modules, Prisma input drift, and unrelated nullability diagnostics; no errors were reported in the changed files. A webpack local server browser smoke loaded `/ai/copilot?context=portfolio-reflection`, rendered the reflection candidate surface, clicked `整理目标`, and captured an `/api/ai/chat` request containing `auditTaskContext` while keeping `taskContext` null.
