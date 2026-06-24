## 1. Shell Preference Contract

- [x] 1.1 Add or identify the shell-owned desktop navigation preference boundary.
- [x] 1.2 Default eligible desktop AppShell navigation to collapsed.
- [x] 1.3 Persist explicit expand/collapse choices across route transitions and remounts.
- [x] 1.4 Treat invalid stored preference values as collapsed without throwing or creating hydration mismatch.

## 2. Navigation Integrity

- [x] 2.1 Preserve icon navigation, accessible names, focus order, active route state, and keyboard operation in collapsed mode.
- [x] 2.2 Verify expanded mode still displays text labels and keeps the approved 248px geometry.
- [x] 2.3 Verify mobile drawer behavior is independent of the desktop persisted state.

## 3. Tests And Evidence

- [x] 3.1 Add unit or component tests for default collapsed state and persisted preference restoration.
- [x] 3.2 Add route-frame tests proving `/knowledge`, Arena, simulations, student learning, teacher workspace, and administrator workspace routes render with valid collapsed metadata.
- [x] 3.3 Capture browser evidence for collapsed default, expanded persisted state, route-to-route persistence across student/teacher/admin representative routes, and 320px mobile behavior.
- [x] 3.4 Run `rtk openspec validate persist-app-shell-navigation-preference --strict`.
