## 1. Platform Mobile Contract

- [x] 1.1 Define mobile viewport, scroll-width, safe-area, z-index, and fixed-action validation rules.
- [x] 1.2 Apply floating dock safe-area rules across audited AppShell and non-AppShell pages.
- [x] 1.3 Add reusable mobile table-to-card or responsive list patterns.

## 2. Accessibility

- [x] 2.1 Fix dialog role/name, focus trap, Escape handling, and hidden-control naming on audited modals.
- [x] 2.2 Fix accessible names for audited AI, chart, canvas, SVG, and icon controls where this change owns the surface.
- [x] 2.3 Add DOM status/live checks that integrate with the action-status contract.

## 3. Verification And Audit Ledger

- [x] 3.1 Verify 320px and 390px pages for admin users, data governance, teacher report, and teacher class-detail representative routes; verify owned AI/floating shell contracts with source-level unit checks.
- [x] 3.2 Run `rtk openspec validate audit-remediation-mobile-a11y-shell --strict`.
- [x] 3.3 Update only verified mobile/a11y audit findings with remediation evidence.
