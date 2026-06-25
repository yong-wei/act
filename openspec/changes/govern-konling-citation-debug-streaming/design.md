## Context

The current streaming route builds a `buildKonlingStreamingCitationGuard(...)` before the final assistant text exists. That guard always adds `assistant-citations-unverified-stream`, marks the answer low confidence, and `insertStreamingCitationFallbackNotice(...)` writes a Chinese diagnostic notice as answer text. This is useful in development, but it is not acceptable as default production student output.

The runtime also uses one citation-context shape for several answer intents. A graph-center concept explanation can have strong content citations while learner-state and path-execution are missing. That should affect personalization, not the existence of a cited answer.

## Goals / Non-Goals

**Goals:**

- Keep development debugging visible and complete.
- Stop production student answers from showing raw citation diagnostics as normal text unless an explicit debug flag enables it.
- Persist the same diagnostics for audit and support review.
- Make answer intent decide which citation classes are required for user-visible confidence.
- Ensure content retrieval can succeed independently from learner-state and path-execution availability.

**Non-Goals:**

- Do not implement a new RAG index or retrieval backend.
- Do not change provider selection or model vendor configuration.
- Do not invent learner data when a student has no learner-state or path-execution records.
- Do not remove citation guard metadata or final answer downgrade rules.

## Decisions

1. Add an environment-controlled debug-injection policy.
   - Development defaults to visible debug injection.
   - Production defaults to no user-visible injection.
   - An explicit flag can override production for controlled debugging.

2. Persist diagnostics separately from answer text.
   - Streaming and persisted session routes must retain `konlingCitationGuard`, missing context, retrieval sources, and personalization availability in metadata.
   - Student-visible content must not include raw guard tokens such as `assistant-citations-unverified-stream` unless debug injection is enabled.

3. Split citation requirements by answer intent.
   - `fact-explanation` requires content citations.
   - `personalized-diagnosis` and `path-advice` require authorized learner-state or path context when making personalized claims.
   - Missing personalization data produces a limitation and style/range downgrade, not a retrieval failure.

4. Keep final guard strict for real citation failures.
   - Missing content citations, inaccessible chunks, privacy violations, or fabricated citations still block, redact, downgrade, or add a user-safe limitation.

## Risks / Trade-offs

- Debug visibility can disappear for production support staff -> persist full metadata and allow explicit flag-based injection.
- Intent classification can under-require personalization evidence -> add tests for graph concept explanation, path advice, and diagnosis modes.
- Existing tests assert the raw notice is inserted -> update them to assert environment-specific behavior and persisted metadata.

## Migration Plan

1. Introduce the debug injection policy without changing model provider behavior.
2. Update stream and persisted-session routes to store guard metadata separately.
3. Update intent-based citation guard rules.
4. Validate concept explanation, personalized diagnosis, and path-advice cases.
5. Deploy with production debug injection disabled.
