## ADDED Requirements

### Requirement: Resource-governance typecheck debt is cleared at source
Resource-governance typecheck repair SHALL align helper/source contracts and fixtures to current resource readiness semantics rather than suppressing TypeScript errors.

#### Scenario: Resource governance typecheck cluster is repaired
- **WHEN** the resource-governance cleanup runs
- **THEN** the errors in `scripts/db/generate-resource-field-completion-audit.ts`, `src/lib/__tests__/resource-field-completion-audit.test.ts`, `src/lib/__tests__/textbook-media-grounding.test.ts`, and `src/lib/learning-goal-resource-baseline.ts` SHALL be eliminated
- **AND** review-confirmed fields, evidence contract completeness, literal artifact versions, and null/undefined policies SHALL remain semantically correct.

#### Scenario: Resource data semantics are out of scope
- **WHEN** this change repairs TypeScript types
- **THEN** it SHALL NOT mark resources complete, promote semantic fields, or alter resource readiness data except where required to fix a typed helper contract.
