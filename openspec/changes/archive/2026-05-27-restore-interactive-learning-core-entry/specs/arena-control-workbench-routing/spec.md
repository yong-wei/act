## ADDED Requirements

### Requirement: Cross-domain exploration excludes duplicate workbench catalog entries
The cross-domain exploration catalog SHALL NOT promote the upgraded multi-representation/classic workbench as a public catalog card when Control Workbench is already exposed as a core student entry.

#### Scenario: Student opens cross-domain exploration
- **WHEN** a student opens `/interactive-learning/cross-domain-exploration`
- **THEN** the catalog SHALL NOT render a hard-coded `综合仿真工作台` or classic four-view workbench card
- **AND** it SHALL render available `FUN_EXPLORATION` resources such as Control Odyssey and Ten Drops where those resources exist.

#### Scenario: Workbench free exploration remains reachable
- **WHEN** a student needs free workbench exploration
- **THEN** the student SHALL use the core Control Workbench entry
- **AND** the Control Workbench free-explore route alias MAY continue to target `/interactive-learning/control-workbench?mode=explore&preset=classic-four-view`.

## REMOVED Requirements

### Requirement: Cross-domain free explore entry targets comprehensive simulation workbench
**Reason**: Control Workbench is now a first-class student core entry, so making cross-domain exploration also pin a workbench card duplicates the same destination and obscures non-workbench exploration resources.

**Migration**: Users should open Control Workbench from the homepage, dashboard, or student navigation for free exploration. Cross-domain exploration should list `FUN_EXPLORATION` resources, while `/interactive-learning/multi-representation-linkage` remains available only as a compatibility surface.
