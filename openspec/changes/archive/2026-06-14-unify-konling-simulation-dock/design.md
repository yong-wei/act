## Context

The design handoff fixes Konling as a unified right-bottom contextual assistant. It should be expandable and consistent across catalog, detail, and mission pages. Simulation pages also have bottom toolbars and side panels, so dock collision rules must be explicit.

## Goals / Non-Goals

**Goals:**

- Provide one Konling entry on simulation-related pages.
- Avoid overlap with bottom toolbar, hints, side panels, and mobile controls.
- Keep assistant expansion useful for context, suggestions, and questions.
- Preserve server-owned context and tool permission boundaries.

**Non-Goals:**

- Add new state-changing Konling tools.
- Replace local simulation controls with chat commands.
- Build teacher/admin assistant workflows in this change.

## Decisions

### 1. One dock, no duplicate assistant regions

Simulation pages should register Konling through the shared dock. Page-local right panels may show evidence or controls, but not a second assistant UI.

Alternative considered: allow each page to keep its own assistant panel. That fragments the assistant model and creates collisions.

### 2. Simulation dock uses safe-area offsets

The dock must offset from bottom toolbar, hint strip, and side panels. Mobile expansion should become a bottom sheet or drawer when needed.

Alternative considered: fixed bottom-right button everywhere. That fails the immersive simulation layout.

### 3. Server-owned context remains authoritative

Konling may know the current simulation, run, route, task, and provenance, but tool permissions and learner context come from server-owned context.

Alternative considered: let client surface metadata drive tool availability. That weakens privacy and scope enforcement.

## Risks / Trade-offs

- Dock offsets can become brittle across page templates. Mitigation: expose DOM metadata and visual evidence for collision checks.
- Removing page-local assistant regions may reduce visible support copy. Mitigation: expanded dock carries contextual suggestions.
- Mobile assistant sheets can conflict with tool sheets. Mitigation: define priority and focus behavior.

## Migration Plan

1. Inventory Konling and assistant-like regions on simulation pages.
2. Register simulation pages with the shared dock model.
3. Remove or adapt duplicate page-local assistant regions.
4. Add simulation page context metadata for the assistant runtime.
5. Capture collision and expansion evidence at desktop and mobile widths.

## Open Questions

- Whether catalog and detail pages should expose different default prompt suggestions.
