## ADDED Requirements

### Requirement: Unified UI governance validates route ownership and shell disposition
Commercial UI governance SHALL validate route ledger ownership, canonical archetype conformance, and legacy shell disposition for unified UI migrations.

#### Scenario: Migrated route is checked
- **WHEN** a route is marked migrated or changed by the unified UI series
- **THEN** governance SHALL verify canonical archetype, owning change, theme support, dock behavior, visual QA profile, and legacy shell disposition
- **AND** missing metadata, duplicate ownership, unowned aliases, or page-local navigation reintroduction SHALL fail according to the current enforcement mode.

#### Scenario: Legacy shell remains temporarily
- **WHEN** a migrated route keeps a legacy shell, local topbar, sidebar, breadcrumb, or fixed control
- **THEN** the exception SHALL name route, violated rule, owner, reason, expiry or removal condition, and downstream issue
- **AND** the exception SHALL not cover new unrelated UI.

### Requirement: Unified UI visual evidence is structured and complete
Commercial UI governance SHALL require structured visual evidence for migrated route families.

#### Scenario: Visual evidence is captured
- **WHEN** visual QA artifacts are produced for a unified UI migration
- **THEN** each artifact SHALL identify route, archetype, theme, viewport, auth state, role state, dock state, navigation state, first-viewport task visibility, timestamp or run id, and result
- **AND** governance SHALL compare requested evidence with produced artifacts and fail missing, stale, or mismatched entries according to enforcement mode.

#### Scenario: Shell states are reviewed
- **WHEN** a shared shell, mission workspace, learner/knowledge/data surface, operations console, or report ledger is changed
- **THEN** evidence SHALL cover the applicable light theme, dark theme, desktop expanded navigation, desktop collapsed navigation, mobile drawer, 320px mobile layout, dock non-overlap, and first-viewport task visibility states.

### Requirement: React Doctor error checks remain local
Commercial UI governance SHALL support local-only React Doctor error-level checks for migrated UI surfaces without requiring GitHub Actions.

#### Scenario: Migrated UI is validated locally
- **WHEN** a developer validates migrated UI surfaces before commit or review
- **THEN** the local check SHALL report React Doctor error-level findings for the affected routes or representative route set
- **AND** the project SHALL not add GitHub Actions integration for this check unless CI quota constraints are explicitly changed.
