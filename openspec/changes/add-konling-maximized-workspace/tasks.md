## 1. Shared assistant shell

- [ ] 1.1 Refactor side and maximized presentations to use one mounted conversation controller.
- [ ] 1.2 Add maximize and restore controls with geometry animation and reduced-motion handling.
- [ ] 1.3 Render the persistent conversation library beside the active conversation in desktop maximized mode.
- [ ] 1.4 Add mobile history drawer behavior while preserving the message list and composer.

## 2. Platform layers and accessibility

- [ ] 2.1 Register Konling, profile controls, overlays, and floating dock under shared shell layer tokens.
- [ ] 2.2 Correct the profile/header collision with Konling controls.
- [ ] 2.3 Add focus trap, focus restoration, Escape behavior, safe areas, and keyboard navigation for both modes.

## 3. Verification

- [ ] 3.1 Test conversation, draft input, streaming, scroll, and focus continuity across maximize and restore.
- [ ] 3.2 Test desktop and mobile layouts, reduced motion, profile menu, floating dock, and representative route overlays.
- [ ] 3.3 Run typecheck, shell tests, accessibility checks, and browser acceptance for both presentation modes.
