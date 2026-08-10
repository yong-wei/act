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
- [x] 4.2 Re-run focused tests, repository-wide TypeScript checks, strict OpenSpec validation, browser smoke, and `git diff --check` on the synchronized integration merge.

Remediation verification on synchronized head `3f7dabb16a`: focused Vitest coverage passed (61 tests across four files); `npx prisma generate` refreshed the worktree's shared Prisma client and `npx next typegen` regenerated Next route types; the full repository `npm run typecheck` then passed; both strict OpenSpec validations passed (change plus 208 specs); and `git diff --check` passed. Existing browser smoke evidence covers `/ai/copilot?context=portfolio-reflection`, the rendered reflection task surface, the `整理目标` action, an `/api/ai/chat` request containing `auditTaskContext`, and a null `taskContext`.
