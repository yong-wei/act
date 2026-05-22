## Purpose
Give administrators a UI-level view of data governance health that matches the evidence reports used by the platform.

## Requirements

### Requirement: Admin dashboard exposes governance report surfaces
The admin data governance dashboard SHALL expose source coverage, session quality, feature cache health, and pipeline health.

#### Scenario: Admin sees session quality distribution
- **WHEN** an administrator opens data governance dashboard
- **THEN** the dashboard shows recent green, yellow, and red session counts using the central session quality status

### Requirement: Admin source coverage explains exclusions
The admin dashboard SHALL show provenance and exclusion reasons for evidence sources.

#### Scenario: Excluded source is explainable
- **WHEN** a source family is seed, demo, showcase, test, unsupported, or context-only
- **THEN** the dashboard reports the exclusion reason and row counts when available
