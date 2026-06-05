## 1. Route Inventory

- [x] 1.1 Extend route inventory with archetype, role scope, navigation layers, mobile behavior, and dock behavior.
- [x] 1.2 Add tests that fail when a primary route lacks shell or navigation metadata.
- [x] 1.3 Resolve student review/profile/data-center semantics in the central navigation model.
- [x] 1.4 Define the homepage as an allowed `public-entry` navigation variant while requiring all other primary routes to use central inventory-driven AppShell or approved workspace shell navigation.

## 2. Shell And Dock Framework

- [x] 2.1 Update shell contracts so AppShell or approved workspace shells own headers, sidebars, breadcrumbs, and account/cockpit actions.
- [x] 2.2 Define legacy shell adapter or retirement status for `UnifiedTopBar`, `ArenaPageShell`, teacher layout, and admin console header.
- [x] 2.3 Unify page floating controls and global AI entry under one dock ownership model.
- [x] 2.4 Add disposition records for `UnifiedTopBar`, `ArenaPageShell`, `TeacherLayout`, `AdminConsoleHeader`, `PageFloatingControls`, and `GlobalAIFloatingButton`.
- [x] 2.5 Replace horizontal-scroll-only mobile navigation with drawer, sheet, tab, or command surfaces that preserve equivalent route-family reachability.
- [x] 2.6 Define dock collision, z-index, safe-area, issue badge, Konling, settings, and management control rules.

## 3. Verification

- [x] 3.1 Verify homepage, login callback, student, Arena, Control Workbench, teacher, admin, and knowledge routes expose correct navigation layers.
- [x] 3.2 Verify 320px mobile routes preserve reachability and do not lose side navigation.
- [x] 3.3 Verify non-home primary routes fail if they keep a page-local topbar, sidebar, breadcrumb, or fixed-control system without a registered disposition.
- [x] 3.4 Run `rtk openspec validate rebuild-navigation-frame-system --strict`.
