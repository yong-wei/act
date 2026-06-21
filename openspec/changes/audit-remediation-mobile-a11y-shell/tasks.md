## 1. Platform Mobile Contract

- [ ] 1.1 Define mobile viewport, scroll-width, safe-area, z-index, and fixed-action validation rules.
- [ ] 1.2 Apply floating dock safe-area rules across audited AppShell and non-AppShell pages.
- [ ] 1.3 Add reusable mobile table-to-card or responsive list patterns.

## 2. Accessibility

- [ ] 2.1 Fix dialog role/name, focus trap, Escape handling, and hidden-control naming on audited modals.
- [ ] 2.2 Fix accessible names for audited AI, chart, canvas, SVG, and icon controls where this change owns the surface.
- [ ] 2.3 Add DOM status/live checks that integrate with the action-status contract.

## 3. Verification And Audit Ledger

- [ ] 3.1 Verify 320px and 390px pages for admin users, data governance, teacher report, evidence, AI, and simulation representative routes.
- [ ] 3.2 Run `rtk openspec validate audit-remediation-mobile-a11y-shell --strict`.
- [ ] 3.3 Update only verified mobile/a11y audit findings with remediation evidence.
