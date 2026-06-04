## 1. Path-Aware Context

- [ ] 1.1 Load server-owned control-correction learner-state slice, active path round, current node, recent evidence, memory summaries, and permitted tools.
- [ ] 1.2 Ensure missing or low-confidence context is visible to prompt construction and response rationale.
- [ ] 1.3 Prevent client-provided page hints from expanding tool or data scope.

## 2. Citation Protocol

- [ ] 2.1 Define citation owners for answers, recommendations, interventions, and report explanations.
- [ ] 2.2 Enforce minimum citation requirements for conceptual answers, personalized recommendations, simulation failure analysis, Arena correction, and teacher-report conclusions.
- [ ] 2.3 Render or return student-visible citation metadata with source type, display title, href, confidence, and evidence basis.

## 3. Intervention Loop

- [ ] 3.1 Persist intervention proposals and outcomes with path id, node id, evidence references, and privacy-safe summaries.
- [ ] 3.2 Ensure accepted, ignored, rejected, and partially accepted outcomes are available to feature-cache refresh.

## 4. Verification

- [ ] 4.1 Add tests that citation-required coaching fails, downgrades, or returns low-confidence fallback when citations are missing.
- [ ] 4.2 Add tests that weak evidence is disclosed instead of overstated.
- [ ] 4.3 Add tests for path context scope, tool permission scope, and intervention outcome persistence.
- [ ] 4.4 Run `rtk openspec validate enforce-cited-konling-path-coaching --strict`.
- [ ] 4.5 Run focused Konling runtime, API chat, and evidence-cache tests.
