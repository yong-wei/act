## ADDED Requirements

### Requirement: Simulation resource palettes are governed
Commercial UI governance SHALL detect migrated simulation resource components that introduce unapproved page-local or resource-local palettes.

#### Scenario: Simulation resource styling is checked
- **WHEN** governance scans changed simulation resource files after this migration
- **THEN** new unapproved hard-coded `bg-white`, `bg-slate-*`, `text-white`, `text-slate-*`, raw hex colors, or resource-local gradient systems SHALL fail or be reported according to the active governance mode
- **AND** approved simulation theme primitives, status tokens, and documented temporary exceptions SHALL be allowed.

### Requirement: Simulation scene theme parity is governed
Commercial UI governance SHALL reject simulation visual evidence that proves only AppShell theme changes without proving simulation-internal scene and panel theme parity.

#### Scenario: Simulation theme evidence is evaluated
- **WHEN** visual evidence is submitted for a migrated simulation detail route
- **THEN** governance SHALL require the evidence to show theme-aware resource panels, local controls, scene visual parameters, HUD labels, and shared dock behavior
- **AND** screenshots where the dark route still embeds an unchanged light scene or white resource panel SHALL fail acceptance unless explicitly documented as a temporary exception with an owner and removal condition.
