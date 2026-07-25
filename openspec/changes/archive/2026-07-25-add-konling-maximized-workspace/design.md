## Context

The shared `KonlingSidebar` is a fixed right panel. The conversation library requires more space, but the default compact assistant remains valuable. The platform shell already owns the floating dock and stacking rules.

## Goals / Non-Goals

**Goals:**

- Add a reversible full-screen assistant workspace.
- Preserve active conversation and streaming continuity.
- Make account, dock, and assistant layers non-overlapping.

**Non-Goals:**

- Replace the default side panel.
- Add new conversation semantics or tool behavior.

## Decisions

### 1. Use one mounted conversation surface

Maximize changes shell layout state rather than remounting a second chat client. Messages, draft input, active request, focus, and scroll state remain owned by one controller.

### 2. Render history as a full-screen navigation rail

The maximized workspace shows the conversation library on the left and active conversation on the right. Mobile uses a drawer for history while retaining the same actions.

### 3. Let the platform shell own layer ordering

Konling, account controls, overlays, and the floating dock use registered platform layers. The maximized surface traps focus, restores focus on exit, respects safe areas, and supports Escape according to the current mode.

### 4. Animate geometry, not content

The transition interpolates panel geometry and opacity while keeping conversation content stable and respecting reduced-motion preferences.

## Risks / Trade-offs

- [Streaming rerenders interrupt animation] → Isolate layout motion from the message list.
- [Mobile history consumes the viewport] → Use a dismissible drawer and preserve input access.
- [New z-index fixes regress other overlays] → Test registered shell layers at representative routes and widths.

## Migration Plan

Ship the mode behind the existing global Konling shell, correct layer tokens, verify side mode unchanged, then enable maximize. Rollback disables the mode without altering sessions.

## Open Questions

None.
