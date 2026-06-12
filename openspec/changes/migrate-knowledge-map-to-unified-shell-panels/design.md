## Context

The current `/knowledge` route renders AppShell only for authenticated roles. Public or unauthenticated users see a standalone `surface-page` wrapper. Inside the graph, `KnowledgeSidebar` renders a fixed `w-[240px]` local sidebar with raw `bg-[#091540]` and blue palette values. Browser evidence shows this page does not participate in the unified shell and its local sidebar visually reads as competing primary navigation.

## Goals / Non-Goals

**Goals:**

- Make `/knowledge` route shell consistent across public, student, teacher, and admin audiences.
- Convert graph-specific directories and filters into local workspace panels that are visually subordinate to AppShell navigation.
- Preserve graph interaction and resource access behavior.

**Non-Goals:**

- Reworking graph algorithms, knowledge data schema, or graph API behavior.
- Replacing the 2D/3D graph canvas implementation.
- Changing knowledge card content or graph taxonomy.

## Decisions

### Decision 1: Public knowledge graph still uses AppShell

Public access does not justify a separate shell. The route can render AppShell with a guest/public role-equivalent navigation set or a public-entry-compatible knowledge-data-map variant while keeping auth-required features gated.

### Decision 2: KnowledgeSidebar becomes a local panel

The chapter directory should be named and styled as a graph local panel. It may remain left-aligned on wide desktops, but it must not look or behave like platform navigation. On mobile it belongs in a drawer/sheet controlled from a graph command surface.

### Decision 3: Local graph palette must converge to platform tokens

The graph can keep domain-specific relation colors for data marks, but shell surfaces, panels, filters, and controls should use platform semantic tokens. Raw route-local blue/purple shell colors should be removed or explicitly registered as chart/data marks.

## Risks / Trade-offs

- Graph controls are dense -> migrating them into AppShell zones must keep efficient filtering and not bury common actions.
- Public and authenticated role navigation differ -> visual evidence must cover public and at least one authenticated role state.
- Graph canvas may need stable sizing after shell migration -> panel wrappers should preserve stable dimensions.
