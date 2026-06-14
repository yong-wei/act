## Context

Product design review for `/knowledge` found that the graph canvas should not compete with an expanded global rail by default. The current AppShell implementation keeps `navigationCollapsed` as local state initialized to expanded. Existing specs cover expanded/collapsed geometry, but not the default state or cross-page persistence.

This change is platform-level. It must benefit all migrated application pages and avoid route-specific storage inside the knowledge graph.

## Goals / Non-Goals

**Goals:**

- Default eligible desktop AppShell routes to collapsed navigation.
- Persist the user's explicit navigation choice across route transitions and remounts.
- Preserve accessibility, active route indication, and mobile behavior.
- Provide deterministic tests and browser evidence for persistence.

**Non-Goals:**

- Redesign navigation content, icons, or route order.
- Move knowledge graph local tools into global navigation.
- Implement the knowledge graph visual redesign.

## Decisions

### 1. AppShell owns the preference

The preference belongs to the shell, not individual pages. Feature pages can declare whether collapsible desktop navigation is allowed, but they cannot store or override a competing local preference.

Alternative considered: let `/knowledge` force collapsed mode locally. That would fix one page while leaving inconsistent behavior across Arena, simulations, and reports.

### 2. Default collapsed, explicit user choice persists

The shell should use a safe collapsed default for eligible desktop layouts, then preserve a user's explicit expand/collapse choice in a stable client preference. Invalid stored values fall back to collapsed.

Alternative considered: default expanded and only remember collapse. That keeps the current dense-workspace problem on first visit.

### 3. Mobile is independent

Desktop rail persistence must not leak into mobile drawer geometry. Mobile continues to use the platform mobile navigation pattern.

## Risks / Trade-offs

- Reading a client preference can cause first-paint movement. Mitigation: render the safe collapsed default and hydrate to the same default unless a valid stored preference exists.
- Some pages may assume expanded width. Mitigation: governance checks representative route frames and text fit in collapsed mode.
- A global preference can hide route labels for first-time users. Mitigation: collapsed rail retains accessible names, active states, and tooltip/title labels.

## Migration Plan

1. Introduce a shell-owned navigation preference helper or hook that defaults to collapsed.
2. Wire the helper into desktop AppShell layout without adding runtime hooks to the pure AppShell contract path.
3. Add tests for default state, preference persistence, invalid stored values, route transitions, and mobile independence.
4. Capture browser evidence for at least `/knowledge`, `/arena`, `/simulations`, one student learning route, one teacher workspace route, and one administrator workspace route.

## Dependencies

- This change should precede or land with the knowledge graph workspace redesign because canvas layout depends on the global rail width.
