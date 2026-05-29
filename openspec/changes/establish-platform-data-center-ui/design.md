## Context

The current admin states page already contains valuable metrics and demo/real data switching, but the UI report calls for a platform-level data center that can support demonstrations, review materials, and governance handoff. This change separates presentation mode from admin governance mode while keeping one visual and status language.

## Goals / Non-Goals

Goals:

- Define `/data-center` as a presentation-oriented surface for aggregate platform metrics, module activity, learning trajectories, simulation/Arena activity, classroom activity, and export-safe snapshots.
- Define `/admin/states` or equivalent admin data-center mode as the governance surface for source coverage, readiness, stale data, missing context, privacy scope, and unsupported states.
- Reuse shared chart panels, status primitives, role navigation, and shell contracts.

Non-goals:

- No replacement of admin governance dashboards, evidence browsers, or teacher governance workspaces.
- No raw learner evidence, raw simulation traces, hidden official evaluation internals, raw answers, or private memory disclosure.
- No metric algorithm or evidence materialization changes.

## Decisions

### Split presentation and governance modes

Presentation mode emphasizes readable aggregate trends, module activity, and snapshot-ready charts. Governance mode emphasizes data source health, privacy scope, readiness, and drilldown limits. Both modes use the same status vocabulary so users can move between demonstration and audit contexts without learning a second UI language.

### Mark source quality explicitly

Every chart or headline metric must identify whether it is based on demo data, real data, partial coverage, stale data, or a restricted source. Presentation surfaces can hide raw details, but they cannot hide source quality.

## Risks

- A presentation data center can overstate platform maturity if demo or partial data is not visible.
- Governance detail can overwhelm presentation use. Mode separation and role-scoped drilldown must remain explicit.

## Verification

- Route or component tests for presentation/governance mode selection and source markers.
- Snapshot/export tests for privacy-safe aggregation and restricted detail removal.
- Browser checks for desktop presentation layout and mobile readable fallback once implemented.
