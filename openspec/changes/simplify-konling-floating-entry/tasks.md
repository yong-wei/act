## Tasks

- [ ] 1. Split theme switching from bottom floating controls.
  - Remove the implicit theme item from the bottom-right floating menu.
  - Ensure AppShell or homepage top-right controls provide theme switching.
  - Verify homepage top-right theme switching is available before removing the bottom-dock theme fallback.

- [ ] 2. Make Konling a direct floating action.
  - When Konling is available, clicking the bottom-right button opens Konling directly.
  - Preserve route context registration and unread state where applicable.

- [ ] 3. Handle routes with additional controls.
  - Move non-Konling controls to approved shell slots or secondary patterns.
  - Avoid reintroducing a generic “工具” trigger as the primary action.

- [ ] 4. Validate visual and interaction behavior.
  - Run `rtk openspec validate simplify-konling-floating-entry --strict`.
  - Capture representative desktop/mobile evidence for `/knowledge`, `/interactive-learning`, `/assessment/adaptive-practice`, `/arena`, and `/simulations`.
  - Verify keyboard reachability and no overlap with local panels.
