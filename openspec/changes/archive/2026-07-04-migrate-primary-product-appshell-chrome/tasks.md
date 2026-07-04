## Tasks

- [x] 1. Normalize primary route metadata.
  - Ensure primary modules and profile-family entry routes use the canonical collapsible navigation model.
  - Ensure active state maps nested primary surfaces to the correct top-level module.

- [x] 2. Centralize primary header actions.
  - Replace route-local Personal Center and theme action placement with the shared shell action order.
  - Keep Konling, assistant docks, path management, returns, exports, settings, filters, and local management commands out of the shell account/theme pair.

- [x] 3. Add breadcrumbs to primary modules.
  - Add or normalize breadcrumbs for Knowledge Graph, Interactive Learning, Learning Path, Arena, Virtual Simulation, Control Workbench, and Personal Center.

- [x] 4. Move local commands to local tool areas.
  - Move path management out of Learning Path shell actions.
  - Move Control Workbench return-to-exploration into content or breadcrumb/contextual return.
  - Keep Arena and Simulation management controls out of the account/theme slot.
  - Document each moved command's stable target zone in tests or route shell metadata.

- [x] 5. Add primary route tests.
  - Verify canonical nav order, collapsible mode, breadcrumb presence, and top-right action order for the representative route matrix.
  - Verify 1440, 1280, 1024, 768, 390, and 320 viewport behavior for the primary route matrix.

- [x] 6. Validate the change.
  - Run `rtk openspec validate migrate-primary-product-appshell-chrome --strict`.
  - Run targeted AppShell, route inventory, and primary route visual/DOM tests.
