## Why

Data Center and simulation audit findings are not covered by current resource/path active changes. They show demo/formal boundary ambiguity, floating control interference with exports, weak simulation task save-back contracts, and missing visible tool regions that make operational and simulation workflows feel incomplete.

## What Changes

- Clarify Data Center role boundaries and demo/formal data source semantics for teacher and admin users.
- Ensure Data Center export actions are reachable despite global floating controls and provide download completion status.
- Add product-level recovery and status feedback for data-center governance handoffs.
- Make simulation command-deck bottom tools visible where the shell contract declares them.
- Require simulation task launch, mission context, and portfolio/save-back flows to preserve task identity and completion state.
- Exclude graph resource grounding, path planning, KAQ writeback, and numerical Rust panel rewrites from this change.

## Capabilities

### New Capabilities
- `audit-remediation-data-center-simulation-workflow`: audit remediation contract for Data Center role/source boundaries, export reachability, simulation task context, command tools, and save-back status.

### Related Capabilities
- `platform-data-center-ui`: require Data Center source quality, role boundary, export status, and governance handoff states.
- `simulation-arena-workbench-experience-ui`: require visible declared tool regions and task context preservation in simulation workspaces.
- `simulation-course-resource-integration`: require simulation task completions to expose explicit save-back or no-save-back status.

## Impact

- Affects `/data-center`, Data Center export/gov handoffs, `/simulations`, simulation detail pages, `/virtual-lab`, mission-linked simulation routes, and simulation-to-portfolio/task return flows.
- Evidence sources include findings 126-127, 197, 202-205, 220-225, and related data-center/simulation entries from the full-system Product Design audit.
- Acceptance requires browser evidence for Data Center export reachability and simulation task/tool visibility.
