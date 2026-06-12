## ADDED Requirements

### Requirement: Report-ledger surfaces preserve evidence and export readability
Commercial report-ledger surfaces SHALL prioritize evidence review, source labels, privacy boundaries, status filtering, and export readiness.

#### Scenario: Report-ledger route or component is migrated
- **WHEN** grading, teacher report, governance snapshot, prep-pack review, assistant effect report, or export UI is migrated
- **THEN** the surface SHALL show source labels, privacy labels, review status, export actions, and key metrics in a readable hierarchy
- **AND** unavailable data SHALL be represented as honest status rather than generated-looking placeholder output.

### Requirement: Runtime overlay and effect reports fit operations/report shells
Future runtime overlay and assistant effect report capabilities SHALL use operations-console or report-ledger slots instead of standalone local shells.

#### Scenario: Overlay or effect report capability becomes available
- **WHEN** overlay preview/review/activate/archive/rollback or deterministic demo/effect report data is displayed
- **THEN** it SHALL use unified shell navigation, evidence/status semantics, privacy boundaries, and export/readiness controls
- **AND** it SHALL not mutate base runtime manifests or fabricate effect metrics in presentation code.
