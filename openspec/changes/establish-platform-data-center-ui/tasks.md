## 1. Data Center Modes

- [ ] 1.1 Define `/data-center` presentation mode regions for headline metrics, module activity, learning trajectory, simulation/Arena activity, classroom activity, and demo snapshots.
- [ ] 1.2 Define `/admin/states` or equivalent governance mode regions for source coverage, readiness, stale data, missing context, privacy scope, and unsupported states.
- [ ] 1.3 Define shared chart panel, filter, date-range, source marker, and status primitive usage across both modes.

## 2. Privacy and Export Boundaries

- [ ] 2.1 Define demo/real/partial/stale/restricted source labels for every chart or headline metric.
- [ ] 2.2 Define export-safe snapshot behavior that removes raw learner evidence, raw traces, hidden official evaluation internals, raw answers, and private memory.
- [ ] 2.3 Define role-scoped drilldown links to admin governance, teacher governance, and evidence browsers without exposing restricted payloads in presentation mode.

## 3. Validation

- [ ] 3.1 Add tests for mode selection, source markers, privacy-safe snapshots, and restricted drilldown behavior.
- [ ] 3.2 Add browser checks for presentation desktop layout and mobile fallback once implemented.
- [ ] 3.3 Validate with `rtk proxy openspec validate establish-platform-data-center-ui --strict`.
