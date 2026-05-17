## ADDED Requirements

### Requirement: Cross-domain free explore entry targets comprehensive simulation workbench
The cross-domain exploration catalog SHALL present the unified workbench as “综合仿真工作台” and route its primary free-explore entry to `/interactive-learning/control-workbench`.

#### Scenario: Cross-domain primary entry opens unified workbench
- **WHEN** a student opens `/interactive-learning/cross-domain-exploration`
- **THEN** the primary entry SHALL be named “综合仿真工作台”
- **AND** it SHALL link to `/interactive-learning/control-workbench?mode=explore&preset=classic-four-view`.

#### Scenario: Arena routing remains on unified workbench
- **WHEN** an Arena task route is built for a supported non-Odyssey workspace
- **THEN** the returned URL SHALL still target `/interactive-learning/control-workbench`
- **AND** it SHALL preserve the `arenaTask` and preset parameters.

#### Scenario: Legacy direct route remains available
- **WHEN** a student opens `/interactive-learning/multi-representation-linkage` directly
- **THEN** the route SHALL remain available as a compatibility surface.
