## 1. AppShell Contract

- [ ] 1.1 Extend AppShell props and adapters to consume canonical route archetype metadata.
- [ ] 1.2 Add archetype variants for public entry, learning atlas, mission workspace, knowledge/data map, operations console, and report ledger.
- [ ] 1.3 Add route-derived breadcrumb, return target, action slot, and theme support behavior.

## 2. Workspace Slots and Dock

- [ ] 2.1 Add shared workspace slots for context header, command bar, instrument area, evidence rail, support drawer, status rail, and local tool areas.
- [ ] 2.2 Move global Konling, management, settings, and support controls behind a shared floating dock contract.
- [ ] 2.3 Ensure dock placement and focus order are consistent across desktop, collapsed navigation, and mobile drawer states.

## 3. Boundary and Compatibility

- [ ] 3.1 Add adapters for legacy shell consumers that cannot migrate immediately.
- [ ] 3.2 Add boundary checks preventing AppShell from importing feature orchestration modules.
- [ ] 3.3 Preserve feature flags or fallback paths for rollback-safe shell adoption.

## 4. Verification

- [ ] 4.1 Run AppShell and route-ledger unit tests.
- [ ] 4.2 Run shell governance tests for dock ownership and legacy shell disposition.
- [ ] 4.3 Run `rtk openspec validate upgrade-platform-app-shell-to-archetype-shell --strict`.
