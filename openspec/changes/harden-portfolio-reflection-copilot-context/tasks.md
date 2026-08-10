## 1. Server task-contract boundary

- [x] 1.1 Add a bounded `auditTaskContext` input type and server parser for portfolio-reflection requests, deriving output and writeback semantics from the existing task contract.
- [x] 1.2 Add a server-generated prompt section that communicates reflection intent and candidate-only writeback rules without exposing raw request or internal runtime fields.

## 2. Copilot and route integration

- [x] 2.1 Add the validated task descriptor to the portfolio-reflection Copilot request body while leaving evidence and general chat bodies unchanged.
- [x] 2.2 Parse the descriptor at `/api/ai/chat`, reject invalid present values with a safe 400 response, and append the resolved contract only to the private system prompt.
- [x] 2.3 Emit one redacted, request-correlated audit event for each accepted reflection task context without logging raw messages, auth data, provider credentials, or internal runtime context.

## 3. Regression coverage

- [x] 3.1 Add unit tests for valid reflection normalization, server-owned output/writeback mapping, malformed input rejection, and internal-field exclusion.
- [x] 3.2 Extend route and Copilot source-contract tests to prove the descriptor reaches the API boundary and that general/evidence behavior remains compatible.
- [x] 3.3 Run focused tests, TypeScript checks, strict OpenSpec validation, and `git diff --check`; run the available browser smoke for the Copilot route.

## 4. Remediation verification

- [x] 4.1 Add a route-level regression for accepted and rejected task contexts, including the emitted audit event payload and the absence of sensitive fields.
- [x] 4.2 Re-run focused tests, strict OpenSpec validation, browser smoke, and `git diff --check`; record the repository-wide typecheck baseline separately.

Remediation verification: focused Vitest coverage passed (43 tests across four files); change and repository strict OpenSpec validation passed; browser smoke loaded `/ai/copilot?context=portfolio-reflection` with HTTP 200 and rendered the reflection task surface; and `git diff --check` passed. The full repository typecheck was re-run and remains blocked by pre-existing control-engine WASM, Prisma input drift, and unrelated nullability errors; no diagnostics point to the changed files.

Verification note: focused Vitest coverage passed (37 tests); both strict OpenSpec validations passed; and `git diff --check` passed. The full repository typecheck was run but remains blocked by pre-existing integration errors in missing control-engine WASM modules, Prisma input drift, and unrelated nullability diagnostics; no errors were reported in the changed files. A webpack local server browser smoke loaded `/ai/copilot?context=portfolio-reflection`, rendered the reflection candidate surface, clicked `整理目标`, and captured an `/api/ai/chat` request containing `auditTaskContext` while keeping `taskContext` null.
