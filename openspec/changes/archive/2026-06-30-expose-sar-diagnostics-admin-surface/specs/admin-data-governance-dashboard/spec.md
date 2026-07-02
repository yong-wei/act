## MODIFIED Requirements

### Requirement: Admin data governance can inspect SAR diagnostics
The admin data governance surface SHALL provide a SAR diagnostics entry point and visible administrator report, not only a raw API payload.

#### Scenario: SAR diagnostics are available
- **WHEN** an administrator inspects AI/data-governance retrieval health
- **THEN** the dashboard or API SHALL include SAR projection counts, query trace summaries, privacy rejection counts, Source Pack handoff counts, verified citation rate, and demo fixture status.

#### Scenario: Administrator opens the SAR diagnostics report
- **WHEN** an administrator opens `/admin/data-governance` or a linked SAR diagnostics route while `sarDiagnostics` is available
- **THEN** the UI SHALL render event, entity, relation, privacy-scope, limitation, Source Pack handoff, verified citation rate, and demo fixture status summaries
- **AND** the UI SHALL expose trace health as safe aggregate or redacted diagnostic rows.

#### Scenario: SAR diagnostics are unavailable
- **WHEN** the admin data-governance status payload has no `sarDiagnostics`
- **THEN** the UI SHALL show an explicit unavailable or degraded diagnostics state
- **AND** it SHALL NOT silently imply SAR health is complete.

#### Scenario: SAR diagnostics contain restricted fixture data
- **WHEN** diagnostic fixtures include private learner answers, hidden Arena internals, private Konling memory, or raw audit-only traces
- **THEN** the administrator UI SHALL omit those raw values
- **AND** tests SHALL assert that known forbidden raw fixture strings are absent from the rendered output.
