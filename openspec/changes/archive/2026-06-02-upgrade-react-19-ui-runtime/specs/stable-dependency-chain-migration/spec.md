## ADDED Requirements

### Requirement: React runtime upgrades validate shared UI and route rendering
The project SHALL validate shared UI primitives, client components, and representative application routes when upgrading the React runtime.

#### Scenario: React 19 upgrade is reviewed
- **WHEN** React and React DOM are upgraded to the selected latest stable React 19 line
- **THEN** typecheck, lint, default tests, unit tests, build, and browser route checks SHALL pass or document explicit blockers
- **AND** React-dependent major package upgrades SHALL remain deferred unless they are required to restore React runtime compatibility.
