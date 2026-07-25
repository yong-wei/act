## Why

Konling's side panel is appropriate for quick help but too narrow for long conversations and history management. Users need an optional focused workspace without losing the current compact interaction.

## What Changes

- Keep the current side panel as the default presentation.
- Add a maximize control that animates the assistant into a full-screen workspace and a restore control that returns to the side panel.
- Show the persistent conversation library on the left only in the maximized workspace and the active conversation on the right.
- Preserve the active conversation, draft input, scroll position, streaming state, and focus across maximize and restore transitions.
- Provide responsive mobile behavior for the maximized workspace and accessible keyboard and focus handling.
- Correct the platform stacking order so account/profile controls never cover Konling controls or messages.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-agent-runtime`: adds presentation-mode continuity requirements for the global assistant.
- `platform-design-system-and-shell`: adds maximized assistant layering, responsive layout, animation, and shared floating-dock collision rules.

## Impact

- Affects the shared Konling shell, platform dock, account header stacking context, responsive navigation, focus management, and conversation library rendering.
- Depends on `add-konling-conversation-library`.
- Does not alter provider behavior, tool semantics, or page-specific tool exposure.
