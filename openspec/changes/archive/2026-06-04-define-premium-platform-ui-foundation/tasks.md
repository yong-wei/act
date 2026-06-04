## 1. Foundation Contract

- [x] 1.1 Update platform brand, shell, navigation, and governance specs with the premium unification contract.
- [x] 1.2 Define the route inventory for public, student, teacher, admin, immersive workspace, and data/governance surfaces.
- [x] 1.3 Define the shared floating action dock contract for Konling and management/settings controls.

## 2. Implementation Planning

- [x] 2.1 Identify current shell implementations to retire, adapt, or keep temporarily.
- [x] 2.2 Map existing design tokens and page-local palettes to approved semantic token roles.
- [x] 2.3 Define visual QA route matrix, themes, viewport sizes, and screenshot artifact locations.

## 3. Verification

- [x] 3.1 Run `rtk openspec validate define-premium-platform-ui-foundation --strict`.
- [x] 3.2 Add or update shell/navigation/floating-dock contract tests.
- [x] 3.3 Run representative background browser screenshots in light and dark themes.
- [x] 3.4 Confirm no implementation work from downstream UI changes is performed in this change.

Verification note: background Playwright screenshots captured 52 route/theme/viewport artifacts under `artifacts/commercial-ui/premium-foundation/2026-06-04T13-34-45-380Z/` and `artifacts/commercial-ui/premium-foundation/2026-06-04T13-58-56-606Z/`; protected cockpit routes include both `unauth-redirect-fallback` evidence and authenticated dock-placement evidence for student, teacher, admin, and data-governance surfaces.
