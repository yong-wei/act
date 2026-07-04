## Why

The primary product modules are the most visible inconsistency. Knowledge Graph lacks the same breadcrumb and Personal Center behavior, Interactive Learning does not show Personal Center, Learning Path puts path management in the shell action area, Arena and Virtual Simulation reverse the expected action order, and Control Workbench adds a return-to-exploration command where the account/theme actions should be.

These pages should all use the same AppShell chrome while keeping their business-specific tools inside the page body or local workspaces.

## What Changes

- Migrate primary product entry pages to the universal AppShell header and collapsible left navigation.
- Normalize right-side header actions to theme switch followed by Personal Center.
- Add or normalize breadcrumbs for Knowledge Graph, Interactive Learning, Learning Path, Arena, Virtual Simulation, Control Workbench, and Personal Center.
- Move path management, return-to-exploration, and other route-local commands out of the shell action pair.
- Add visual and DOM checks for the primary route matrix.

## Impact

- Touches the primary product page shells and their wrappers.
- Depends on `define-universal-appshell-frame-contract`.
- Does not migrate every deep runtime page; that is handled by the follow-up deep-route migration.
