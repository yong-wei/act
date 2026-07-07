## ADDED Requirements

### Requirement: Konling typecheck fixtures match current context contracts
Konling typecheck repair SHALL update test fixtures and assertion helpers to current context contracts without changing model behavior.

#### Scenario: Konling typecheck cluster is repaired
- **WHEN** the Konling cleanup runs
- **THEN** TypeScript errors in `src/lib/__tests__/konling-agent-runtime.test.ts` and `src/lib/__tests__/konling-teaching-assistant-server-context.test.ts` SHALL be eliminated
- **AND** tool outputs, context keys, page types, knowledge types, and learner-state fixtures SHALL remain narrow and contract-valid.

#### Scenario: Konling runtime behavior is out of scope
- **WHEN** this change repairs TypeScript tests
- **THEN** it SHALL NOT change provider configuration, prompt policy, or citation verification behavior unless a production type contract is demonstrably wrong.
