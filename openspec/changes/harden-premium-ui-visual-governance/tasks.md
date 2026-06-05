## 1. Governance Rules

- [ ] 1.1 Add route ledger coverage and archetype conformance checks.
- [ ] 1.2 Add dual theme, 1440px/320px, auth/role, first-viewport task, and dock collision evidence checks.
- [ ] 1.3 Add mobile structure rules for sidebars, filters, workbench panels, and knowledge graph drawers.
- [ ] 1.4 Add blocking rules for non-home primary routes missing unified navigation frame metadata or retaining unregistered page-local shells.
- [ ] 1.5 Add blocking rules for outdated archetype names, legacy shell without disposition, dock collision, mobile canvas-not-first, persistent mobile sidebar/filter panels, and screenshot capture incompleteness.

## 2. Exceptions And Reports

- [ ] 2.1 Add scoped exception format with owner, owning change, violated rule, expiry, and removal condition.
- [ ] 2.2 Add report/export visual evidence checks for watermark, privacy, source, and readability.
- [ ] 2.3 Add manifest structure checks for visual QA artifacts.
- [ ] 2.4 Add governance matrix coverage for `/arena`, `/assessment/adaptive-practice`, `/profile`, `/data-center`, teacher/admin role routes, knowledge/data surfaces, and report-ledger outputs.
- [ ] 2.5 Add checks that route inventory and visual QA matrix drift is reported explicitly.

## 3. Verification

- [ ] 3.1 Run `rtk npm run test:commercial-ui-governance`.
- [ ] 3.2 Run `rtk npm run test:theme-coverage`, `rtk npm run test`, and relevant unit tests.
- [ ] 3.3 Verify the final gate rejects representative routes with local accent palettes, disconnected loading states, missing journey next action, or missing report/export provenance.
- [ ] 3.4 Run `rtk openspec validate harden-premium-ui-visual-governance --strict`.
