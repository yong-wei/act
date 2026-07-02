## 1. Debug Injection Policy

- [x] 1.1 Define a server-side Konling citation debug injection policy with development default-on and production default-off behavior.
- [x] 1.2 Add an explicit environment override for production support debugging.
- [x] 1.3 Update streaming citation fallback tests for development, production, and explicit override cases.

## 2. Citation Guard Runtime

- [x] 2.1 Refactor `buildKonlingStreamingCitationGuard` so stream-final-text uncertainty is metadata, not an unconditional user-visible low-confidence reason.
- [x] 2.2 Make citation class requirements depend on answer intent and personalized claim scope.
- [x] 2.3 Ensure graph-center concept explanations can return verified content citations when learner-state and path-execution are missing.
- [x] 2.4 Ensure personalized diagnosis and path-advice outputs record limited-personalization status when learner evidence is absent.

## 3. Persistence And Session Records

- [x] 3.1 Persist citation guard metadata, missing-context metadata, retrieval source summaries, and personalization availability in streaming chat records.
- [x] 3.2 Persist the same metadata for `/api/ai/sessions/[id]/messages`.
- [x] 3.3 Keep student-visible assistant text free of raw diagnostic tokens in production.

## 4. Verification

- [x] 4.1 Add unit tests for concept explanation, personalized diagnosis, and path-advice citation guard behavior.
- [x] 4.2 Add route-source or integration tests proving production streaming does not inject raw diagnostics while metadata remains available.
- [x] 4.3 Add tests proving development/debug mode can still inject complete diagnostics.
- [x] 4.4 Run `rtk openspec validate govern-konling-citation-debug-streaming --strict`.
