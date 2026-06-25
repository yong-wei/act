## Why

Konling currently injects citation-guard diagnostics into the beginning of streaming answers even on production pages. This exposes internal learner-state and path-execution limitations to students before the answer, and it incorrectly treats missing personalization data as a citation failure for ordinary concept explanations.

## What Changes

- Gate streaming citation-debug text injection by environment and an explicit runtime flag.
- Keep complete citation guard, missing-context, retrieval-source, and personalization-availability metadata in persisted Konling records for review.
- Make concept explanations citation-first: high-authority content, graph, textbook, handout, and knowledge-card citations must be returned even when learner-state or path-execution data is missing.
- Treat missing learner-state or path-execution as personalization limitations unless the answer makes personalized diagnosis, path, grading, report, or intervention claims.
- Preserve low-confidence fallback behavior for genuinely missing, inaccessible, or invalid citations.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-agent-runtime`: Separate student-visible answers, debug injection, persisted citation metadata, and personalization limitations by answer intent and environment.
- `learning-evidence-rag-corpus`: Clarify that content citations remain available when learner evidence is absent, and that learner evidence is only required for personalized claims.

## Impact

- Server routes: `src/app/api/ai/chat/route.ts`, `src/app/api/ai/sessions/[id]/messages/route.ts`.
- Runtime logic: `src/lib/konling-agent-runtime.ts`, `src/lib/konling-streaming-citation-fallback.ts`.
- Tests: Konling runtime guard tests, streaming citation fallback tests, AI route runtime guard tests, and citation/RAG corpus contract tests.
