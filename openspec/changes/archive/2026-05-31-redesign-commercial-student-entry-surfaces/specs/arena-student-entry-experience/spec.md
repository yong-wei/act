## ADDED Requirements

### Requirement: Arena hall follows the commercial challenge-entry model
The Arena hall SHALL render as a commercial challenge-entry surface using the platform brand language, student navigation hierarchy, compact discovery, and governed evidence/status semantics.

#### Scenario: Student opens Arena hall
- **WHEN** a student opens `/arena`
- **THEN** the hall SHALL expose challenge discovery, leaderboard context, task readiness, and workbench entry in a branded commercial layout
- **AND** it SHALL avoid oversized decorative hero areas, page-local palettes, and unrelated feature cards that push challenge content below the first viewport.

### Requirement: Arena challenge cards expose actionable context
Arena challenge cards SHALL prioritize task identity, method context, official evaluation state, readiness, and the primary entry action.

#### Scenario: Challenge card renders
- **WHEN** an Arena challenge card is visible
- **THEN** the card SHALL show the task state and primary action without requiring the student to inspect a separate decorative section
- **AND** status labels SHALL use shared evidence and evaluation semantics rather than raw policy ids or page-local badges.
