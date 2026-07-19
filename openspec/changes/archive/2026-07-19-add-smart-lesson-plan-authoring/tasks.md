## 1. Lesson task and context

- [x] 1.1 Add persistence and APIs for single-lesson tasks, mutable plan drafts, immutable plan revisions, source selections, and class-diagnosis references.
- [x] 1.2 Build setup for course basis, 45/90/custom duration, audience, prerequisites, optional class, and optional outline-confirmation pause.
- [x] 1.3 Implement source-grounded knowledge-point suggestions plus teacher select, rename, merge, and manual-create actions with lineage.
- [x] 1.4 Implement goal suggestion, editing, standards/textbook mapping, and explicit confirmation before full generation.
- [x] 1.5 Persist the shared `verified`, `ai_generated_source_pending`, and `teacher_created_source_pending` goal-source states plus stable goal-gap identities bound to goal content, source-binding-set, canonical state, and smart-task lineage.
- [x] 1.6 Add governed aggregate class-diagnosis projection and tests proving raw answers and private learner traces cannot enter prompts.
- [x] 1.7 Mount Konling `prep-coauthor` on the smart-preparation workspace and implement natural-language task creation, ambiguity clarification, multi-turn confirmed diffs, mixed form/chat concurrency, and session ownership tests.

## 2. Durable structured generation

- [x] 2.1 Add Provider Registry task selection and persisted provider, model, prompt, schema, request, token, and cost audit metadata.
- [x] 2.2 Implement Postgres-backed generation job/stage transitions and BullMQ delivery with one active job per draft.
- [x] 2.3 Implement idempotent start, resume, retry, and cancel behavior that preserves completed stages and prevents duplicate attempts.
- [x] 2.4 Add a deterministic fixture provider for success, progressive output, invalid schema, retryable failure, cancellation, and resume, and reject it in production.

## 3. Plan generation and approval

- [x] 3.1 Define the complete text-plan schema for BOPPPS fields, exact timing, sources, limitations, class adaptation, and courseware-step outline.
- [x] 3.2 Implement outline-first internal generation, optional confirmation pause, and progressive BOPPPS module filling for fast first response.
- [x] 3.3 Build progress, partial-result, failure, cancellation, editable-draft, and stale-downstream-material states.
- [x] 3.4 Implement deterministic structure/time/source checks and optional advisory one-click AI review that cannot approve or block.
- [x] 3.5 Implement teacher approval as immutable sequential `教案第N版` snapshots, preserve pending goal-gap identities without creating acknowledgements, and require an approved revision for downstream generation.
- [x] 3.6 Run state-machine, authorization, versioning, resume, privacy, validation, provider, both-pending-lineage, goal-gap stability/change/delete-recreate, no-implicit-acknowledgement, typecheck, and strict OpenSpec tests; record AC evidence.

## Acceptance evidence

- `npx prisma generate` and `npx prisma validate` passed against the new schema and migration.
- `npm run typecheck` passed.
- Smart Lesson module tests: 56 passed, 3 environment-gated tests skipped.
- Smart Lesson API and Konling integration tests: 215 passed.
- Real PostgreSQL and Redis/BullMQ seam tests: 3 passed.
- Real browser E2E passed through Next.js, production API routes, BullMQ worker, Course Basis Source Pack, deterministic fixture provider, advisory review, and immutable teacher approval without route interception.
- Focused independent review accepted and verified fixes for bounded, signal-aware E2E resource cleanup; no remaining P0-P2 findings.
- Current-head Codex feedback on confirmed task facts, canonical source bindings, superseded job recovery, and paused-outline invariants was fixed and independently re-reviewed with no remaining P0-P2 findings.
- `openspec validate add-smart-lesson-plan-authoring --strict` and `git diff --check` passed.
