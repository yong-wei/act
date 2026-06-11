## Why

PR #369 merged the Arena workspace shell while one actionable review thread remained unresolved: the mobile navigation drawer used dialog semantics but did not move focus into the drawer, trap keyboard focus while open, or restore focus to the opener after close.

This leaves keyboard users able to tab into the underlying page while the mobile drawer is visually active, which breaks the shell's navigation contract.

## What Changes

- Trap focus inside the Arena mobile drawer while it is open.
- Move initial focus to the drawer close control and restore focus to the opener when the drawer closes.
- Mark the underlying shell content inert and hidden from assistive navigation while the drawer is open.
- Add focused regression coverage for the drawer focus lifecycle.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `arena-student-entry-experience`: Clarifies the Arena mobile drawer keyboard focus contract.

## Impact

- Affects the shared Arena page shell used by the Arena hall and challenge detail pages.
- Does not alter desktop navigation, challenge data, leaderboard semantics, or workbench routing.
