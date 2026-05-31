## 1. Data Center Modes

- [x] 1.1 Define `/data-center` presentation mode regions for headline metrics, module activity, learning trajectory, simulation/Arena activity, classroom activity, and demo snapshots.
- [x] 1.2 Define `/admin/states` or equivalent governance mode regions for source coverage, readiness, stale data, missing context, privacy scope, and unsupported states.
- [x] 1.3 Define shared chart panel, filter, date-range, source marker, and status primitive usage across both modes.

## 2. Privacy and Export Boundaries

- [x] 2.1 Define demo/real/partial/stale/restricted source labels for every chart or headline metric.
- [x] 2.2 Define export-safe snapshot behavior that removes raw learner evidence, raw traces, hidden official evaluation internals, raw answers, and private memory.
- [x] 2.3 Define role-scoped drilldown links to admin governance, teacher governance, and evidence browsers without exposing restricted payloads in presentation mode.

## 3. Validation

- [x] 3.1 Add tests for mode selection, source markers, privacy-safe snapshots, and restricted drilldown behavior.
- [x] 3.2 Add browser checks for presentation desktop layout and mobile fallback once implemented.
- [x] 3.3 Validate with `rtk proxy openspec validate establish-platform-data-center-ui --strict`.
