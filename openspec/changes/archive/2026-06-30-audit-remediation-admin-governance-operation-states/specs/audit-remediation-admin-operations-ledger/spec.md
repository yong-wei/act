## ADDED Requirements

### Requirement: Admin operations shall use durable status across user config governance and exports
Admin user import, user search/export, configuration save, model test, governance resolve, and usage export operations SHALL expose durable operation identity, status, audit summary, and recovery.

#### Scenario: an admin performs import, export, save, test, refresh, resolve, or download actions
- **WHEN** an admin performs import, export, save, test, refresh, resolve, or download actions
- **THEN** the UI SHALL show operation id or safe reference, affected scope, status, artifact availability, next step, and failure recovery.

#### Scenario: the API returns no matches, invalid filters, or unsupported operation context
- **WHEN** the API returns no matches, invalid filters, or unsupported operation context
- **THEN** the UI and API SHALL use the same filtered result contract and SHALL NOT show unrelated real users as a fallback.

### Requirement: Admin mobile governance shall be task usable
Admin governance, user, and configuration pages SHALL keep primary operations usable at 320px and 390px without document-level overflow.

#### Scenario: an admin uses audited mobile widths
- **WHEN** an admin uses audited mobile widths
- **THEN** import, search, resolve, export, save, and model-test controls SHALL remain reachable and associated with their status panel.

#### Scenario: governance data is presented as tables
- **WHEN** governance data is presented as tables
- **THEN** the mobile layout SHALL use cards, stacked rows, or explicit internal scrolling with visible affordance rather than widening the page.
