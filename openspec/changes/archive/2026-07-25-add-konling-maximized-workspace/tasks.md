## 1. Shared assistant shell

- [x] 1.1 Refactor side and maximized presentations to use one mounted conversation controller.
- [x] 1.2 Add maximize and restore controls with geometry animation and reduced-motion handling.
- [x] 1.3 Render the persistent conversation library beside the active conversation in desktop maximized mode.
- [x] 1.4 Add mobile history drawer behavior while preserving the message list and composer.

## 2. Platform layers and accessibility

- [x] 2.1 Register Konling, profile controls, overlays, and floating dock under shared shell layer tokens.
- [x] 2.2 Correct the profile/header collision with Konling controls.
- [x] 2.3 Add focus trap, focus restoration, Escape behavior, safe areas, and keyboard navigation for both modes.

## 3. Verification

- [x] 3.1 Test conversation, draft input, streaming, scroll, and focus continuity across maximize and restore.
- [x] 3.2 Test desktop and mobile layouts, reduced motion, profile menu, floating dock, and representative route overlays.
- [x] 3.3 Run typecheck, shell tests, accessibility checks, and browser acceptance for both presentation modes.
