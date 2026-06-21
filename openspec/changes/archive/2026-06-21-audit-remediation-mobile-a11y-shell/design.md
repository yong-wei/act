## Context

Mobile issues are not isolated CSS defects. The audit finds repeated 945px admin pages at 320/390px, 568px governance pages, long teacher report pages, floating tool overlap, modal focus leakage, and missing announcements.

## Goals / Non-Goals

**Goals:**
- Make audited mobile breakpoints usable without horizontal overflow.
- Keep primary actions reachable on long pages.
- Ensure dialogs and sidebars contain focus and have accessible names.
- Apply safe-area rules for global and local floating controls.

**Non-Goals:**
- Do not redesign every visual style.
- Do not solve domain workflows already covered by student, teacher, admin, AI, or Arena changes.

## Decisions

- Mobile validation must check document scroll width, not only screenshots.
- Long task pages must expose current primary action near the user decision point.
- Floating tools require a platform z-index and safe-area contract.
- A11y remediation must include keyboard path, dialog role/name, Escape behavior, and status announcement.

## Risks / Trade-offs

- Fixed action bars can hide content if applied blindly. Mitigation: require content padding and safe-area tests.
- Table-to-card conversion may lose columns. Mitigation: define priority fields and detail expansion for mobile.
