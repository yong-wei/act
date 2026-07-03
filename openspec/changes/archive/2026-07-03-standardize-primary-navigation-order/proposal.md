## Why

Primary navigation currently comes from several places: homepage entry groups, AppShell route navigation, role cockpit entries, and teacher operation tabs. The user-facing order is therefore inconsistent even though wide-screen modules already use the correct collapsible rail pattern.

The platform needs one canonical first-level order so every primary module, collapsed rail, expanded rail, homepage entry, and account route speaks the same information architecture.

## What Changes

- Define the canonical first-level order: Home, Knowledge Resources, Interactive Learning, Learning Path, Arena, Virtual Simulation, Control Workbench, Personal Center.
- Make student primary navigation, homepage entry ordering, and AppShell route navigation derive from one source of truth.
- Preserve the existing collapsed/expanded left rail behavior; folded icon-only navigation remains correct and expands to text.
- Add tests or governance checks that fail when a page-local order diverges from the canonical order.
- Clarify that route-local tools and secondary teacher/admin navigation may exist only as subordinate navigation, not competing first-level navigation.

## Impact

- Updates `platform-role-navigation` expectations and route inventory checks.
- Provides the prerequisite for homepage, profile/dashboard, Konling dock, and role workspace unification changes.
- Does not redesign the visual shell or replace teacher/admin pages by itself.
