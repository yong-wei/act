## ADDED Requirements

### Requirement: Admin dashboard exposes SAR refresh health
The admin data governance dashboard SHALL show whether the persisted SAR projection index is fresh, stale, degraded, or failed.

#### Scenario: SAR refresh health is available
- **WHEN** an administrator opens the data governance dashboard after SAR refresh health has been recorded
- **THEN** the UI or payload SHALL show last attempted refresh, last successful refresh, projected source families, stale source counts, failure counts, retry state, and limitation summaries
- **AND** the dashboard SHALL NOT expose raw learner answers, hidden Arena internals, private Konling memory, or raw audit traces.
