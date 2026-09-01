## 1. Establish the canonical seam

- [ ] 1.1 Inventory provider selection, message conversion, stream parsing, tool/citation normalization, timeout/Abort and redaction callers across Web, worker, tooling and test graphs.
- [ ] 1.2 Add characterization fixtures for OpenAI-compatible and Anthropic-compatible response/stream shapes, malformed frames, tool calls, citations, finish states and provider failures.
- [ ] 1.3 Record that `PlatformSetting` and the existing provider compatibility matrix remain the sole configuration authority; reject any parallel config source in tests.

## 2. Consolidate runtime behavior

- [ ] 2.1 Implement the smallest shared provider/stream path inside the existing `src/lib/ai` owner while preserving current public response and error contracts.
- [ ] 2.2 Route API, interactive, smart-preparation, diagnosis and admin provider callers through the canonical path, preserving ingress schema, timeout, cancellation and privacy boundaries.
- [ ] 2.3 Prove synchronous and streaming calls produce equivalent normalized text, tool, citation and terminal semantics without exposing provider-specific payloads.
- [ ] 2.4 Remove only duplicate parsers, wrappers and aliases with no remaining callers; retain any necessary ingress adapter as non-authoritative and documented.

## 3. Guard business and delivery boundaries

- [ ] 3.1 Add regressions proving AI output cannot create or overwrite course, assessment, LearningFact, learner-profile, publication or production-selector facts.
- [ ] 3.2 Verify AppShell, role checks, SSR/R3F boundaries and existing release/rollback security validator remain unchanged.
- [ ] 3.3 Run affected unit/route/component tests, production and tooling typechecks, lint, `verify:commit`, `verify:push`, and diff checks.

## 4. Handoff evidence

- [ ] 4.1 Record before/after import and behavior evidence, deleted aliases, retained adapters and rollback mapping.
- [ ] 4.2 Run `openspec validate consolidate-ai-provider-and-stream-runtime --type change --strict` and obtain review before unblocking C29.
