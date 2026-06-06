## Why

The current commercial UI governance checks catch some token, route, theme, and dock evidence gaps, but they do not yet enforce full route ledger coverage, archetype conformance, mobile task usability, report/export evidence, or temporary exception expiry.

## What Changes

- Harden commercial UI governance around route ledger coverage, archetype conformance, dual theme evidence, 1440px/320px screenshots, auth/role states, dock collision, and report/export checks.
- Add advisory-to-blocking migration mode so known legacy debt does not hide new regressions.
- Require exceptions to name owner, change, expiry/removal condition, and violated rule.
- Add blocking rules for non-home primary routes with missing unified navigation metadata, outdated archetype names, unregistered legacy shells, dock collisions, persistent mobile sidebars/filters, and mobile canvas-not-first layouts.
- Enforce visual evidence capture completeness and route inventory versus visual QA matrix drift detection.
- Extend governance coverage to `/arena`, `/assessment/adaptive-practice`, `/profile`, `/data-center`, teacher/admin role routes, knowledge/data surfaces, and report-ledger outputs.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-ui-governance-gates`: strengthens visual and route governance requirements.

## Impact

- Affects `src/lib/commercial-ui-governance.ts`, `scripts/tests/test-commercial-ui-governance.ts`, visual QA manifests, route inventory tests, and default test expectations.
