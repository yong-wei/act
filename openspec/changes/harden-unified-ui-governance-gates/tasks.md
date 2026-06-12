## 1. Route and Shell Governance

- [ ] 1.1 Enforce canonical archetype, owning change, theme support, dock behavior, and visual QA profile metadata for migrated routes.
- [ ] 1.2 Enforce legacy shell retirement, adapter disposition, or narrow temporary exception metadata.
- [ ] 1.3 Detect duplicate ownership, unowned aliases, and page-local navigation reintroduction on migrated routes.

## 2. Visual Evidence Governance

- [ ] 2.1 Extend visual evidence manifests with route, archetype, theme, viewport, auth state, role state, dock state, navigation state, first-viewport task visibility, and result fields.
- [ ] 2.2 Compare requested route matrices with captured artifacts and fail stale, missing, or mismatched evidence.
- [ ] 2.3 Require representative evidence for light/dark, desktop, 320px mobile, expanded/collapsed navigation, mobile drawer, dock non-overlap, and report/export readability where applicable.

## 3. Local Quality Gates

- [ ] 3.1 Add or document local-only React Doctor error-level validation for migrated UI surfaces.
- [ ] 3.2 Ensure governance checks do not depend on GitHub Actions.
- [ ] 3.3 Produce actionable errors naming route, rule, owning change, and remediation path.

## 4. Verification

- [ ] 4.1 Run commercial UI governance tests.
- [ ] 4.2 Run route-ledger governance tests.
- [ ] 4.3 Run local React Doctor error-only check or document why it is unavailable.
- [ ] 4.4 Run `rtk openspec validate harden-unified-ui-governance-gates --strict`.
