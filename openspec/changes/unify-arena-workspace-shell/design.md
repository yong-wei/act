## Context

Arena currently has the strongest visible shell pattern in the student product: a left project-entry rail, breadcrumb header, and personal-center action. It is still local to `src/features/arena/arena-page-shell.tsx`, not collapsible, and not aligned with the generic `AppShell` used by Data Center. Other second-level pages still show fixed-width top navigation, centered narrow content, always-visible filters, or local title bars.

This change deliberately starts with Arena only. The goal is to make one satisfying, testable shell prototype before applying it to knowledge graph, interactive learning, virtual simulation, adaptive learning, or data center pages.

The design guidance from the frontend skills should be applied selectively. This is a dense teaching workspace, not a marketing landing page. The useful parts are premium material hierarchy, careful motion, typography discipline, consistent visual assets, and avoidance of generic AI decoration. The parts to avoid are large hero sections, AIDA page structure, excessive scroll storytelling, and decorative image placement that hides the task.

## Goals / Non-Goals

**Goals:**

- Establish an Arena-first unified workspace shell with collapsible left navigation, sticky breadcrumb top bar, personal-center action, responsive mobile drawer, and task-first full-width content.
- Use Arena as the quality reference for later migration of knowledge graph, interactive learning, virtual simulation, adaptive learning, and data center.
- Centralize Arena visual-world assets in a single platform asset directory and prevent page-local scatter.
- Remove visible commercial vocabulary and emoji-like symbols from Arena student-facing UI.
- Preserve Arena domain ownership: challenge filtering, publication access, leaderboard policies, workbench routing, and evaluation semantics remain in Arena feature modules.

**Non-Goals:**

- Do not migrate every second-level page in this change.
- Do not redesign scoring, submissions, workbench routing, publication access, or evaluation protocol.
- Do not introduce a new external UI framework.
- Do not add decorative marketing hero sections.
- Do not make generated visual assets responsible for readable UI text.

## Decisions

1. **Arena-first prototype rather than global migration**

   Start by upgrading or extracting the existing Arena shell. This keeps the change small enough to review visually while creating a real reference implementation. A platform-wide replacement before Arena is accepted would likely reproduce the previous problem: shell contracts without obvious visible improvement.

2. **Shared workspace shell API with Arena as first consumer**

   The implementation should either promote `ArenaPageShell` into a shared shell or create a new shared shell and adapt Arena to it. The shell should accept navigation, active path, breadcrumbs, title/context slots, actions, and content width mode. Arena business data should stay outside the shell.

3. **Collapsible navigation over another fixed top navigation**

   The left rail should support expanded and collapsed states on desktop, with mobile drawer behavior at narrow widths. This directly addresses fixed-width top navigation overflow and gives later pages a consistent navigation model.

4. **Centralized visual-world assets**

   Arena visual assets should live under one platform-owned directory, for example `public/assets/platform/visual-worlds/arena/`. Generated images should contain no rendered text. Any asset manifest, import helper, or usage map should be centralized with platform UI code, not scattered inside individual route folders.

5. **Icon and asset system instead of emoji**

   Navigation and status symbols should use the project's established icon family and shared status semantics. Visual assets should provide domain identity at entry cards, empty states, and optional shell accents. Emoji-style symbols should not be used for premium workspace identity.

6. **Restrained motion**

   Motion should be limited to transform and opacity: rail expand/collapse, drawer reveal, card hover, filter drawer transition, and subtle page entry. Large scroll-pinned effects are inappropriate for repeated teaching workspaces.

## Risks / Trade-offs

- **Risk: shared shell becomes too generic** -> Keep Arena as the only consumer first and only generalize props proven by Arena hall/detail needs.
- **Risk: generated assets feel decorative or AI-like** -> Require no text inside assets, low-saturation domain visuals, and screenshot review in both themes.
- **Risk: mobile drawer hides primary task** -> Mobile acceptance must show that the challenge list or challenge detail action is reachable without scrolling through shell controls.
- **Risk: theme parity regresses** -> Visual QA must capture light and dark states for shell, cards, navigation, and any asset-backed areas.
- **Risk: duplicated controls remain** -> Acceptance must check personal center, theme switch, and floating dock placement together.

## Migration Plan

1. Build the Arena shell prototype and visual assets behind the existing Arena routes.
2. Migrate `/arena` and `/arena/challenges/[taskId]` only.
3. Validate desktop, wide desktop, mobile, light, dark, expanded rail, collapsed rail, and mobile drawer states.
4. After Arena acceptance, use a later change or series to migrate knowledge graph, interactive learning, virtual simulation, adaptive learning, and data center.
