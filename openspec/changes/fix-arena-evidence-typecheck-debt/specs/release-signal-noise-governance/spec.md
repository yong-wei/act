## ADDED Requirements

### Requirement: Arena typecheck debt preserves official evaluation authority
Arena typecheck repair SHALL update evidence and leaderboard fixtures without changing official scoring or ranking authority.

#### Scenario: Arena cluster is repaired
- **WHEN** the Arena cleanup runs
- **THEN** TypeScript errors in Arena evidence writeback persistence and leaderboard tests SHALL be eliminated
- **AND** mocked evidence writeback payloads and submission input fixtures SHALL match current contracts.

#### Scenario: Arena authority remains unchanged
- **WHEN** this change repairs TypeScript fixtures
- **THEN** it SHALL NOT change official Arena score, validity, ranking, leaderboard position, or official submission result semantics.
