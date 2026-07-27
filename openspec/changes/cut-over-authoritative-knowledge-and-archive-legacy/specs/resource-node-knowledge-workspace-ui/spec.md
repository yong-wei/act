## ADDED Requirements

### Requirement: Main knowledge workspace removes the Legacy switch after cutover
After production authority cutover, the main knowledge workspace MUST show only the active ActKG graph and MUST provide Legacy history through a separate read-only archive route.

#### Scenario: User opens the main graph after cutover
- **WHEN** ActKG is the active authority
- **THEN** the workspace SHALL omit the migration-period old-version toggle

#### Scenario: User opens Legacy Archive
- **WHEN** the user follows an authorized historical entry
- **THEN** the archive SHALL display fixed historical content without edit, Konling, recommendation, resource, path, or learning-fact controls

### Requirement: Legacy-bound interface state is reset at cutover
Favorites, canvas layouts, and recent-visit records that reference Legacy node IDs MUST be reset within the retired Legacy scope and MUST NOT be mapped to Canonical Objects.

#### Scenario: User has Legacy graph preferences
- **WHEN** production authority cutover completes
- **THEN** the main candidate workspace SHALL start without migrated Legacy favorites, layouts, or recent-node entries while historical node notes remain available only in Legacy Archive
