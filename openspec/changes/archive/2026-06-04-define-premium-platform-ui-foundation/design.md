## Context

The current platform has several partially successful patterns: simulation scenes already behave like immersive task workspaces, Control Workbench is close to an engineering analysis surface, and existing platform specs already define commercial brand and AppShell primitives. The failure is consistency: many pages still use local shells, local palettes, unrelated card grids, and independent floating controls.

The intended baseline includes unfinished future capabilities such as persistent control-correction paths, adaptive learner state, intelligent teaching assistant workflows, and role-based diagnosis views. This change does not block on those implementations. It defines the UI and navigation rules those future capabilities must consume when they land.

## Goals / Non-Goals

**Goals:**

- Make premium platform visual language explicit for both light and dark themes.
- Define one navigation grammar across public, student, teacher, admin, and workspace pages.
- Define a shared floating action dock for Konling and management/settings controls.
- Define route inventory and visual QA requirements that downstream UI changes must satisfy.

**Non-Goals:**

- Redesigning every target page in this change.
- Replacing domain-owned simulation, Arena, adaptive, teacher, or admin logic.
- Changing authentication, authorization, or data ownership rules.

## Decisions

### Decision 1: Use a multi-layer navigation model

Navigation must separate global product destinations, role cockpit actions, contextual workspace routes, and local tool controls. This prevents every page from showing a competing bespoke header.

### Decision 2: Keep dark and light themes equally designed

Dark mode should read as a night-navigation control desk. Light mode should read as matte chart paper and engineering instruments, not as a washed-out fallback.

### Decision 3: Treat bottom-right controls as shared shell infrastructure

Konling and management/settings controls currently drift in position and shape across pages. They should become a shared dock with stable spacing, collision rules, keyboard access, responsive collapse, and role-aware visibility.

### Decision 4: Use background browser screenshots as acceptance evidence

The current background Playwright approach works without depending on the Codex window size. Downstream UI changes should capture representative desktop and mobile screenshots in light and dark themes.

## Validation

- `rtk openspec validate define-premium-platform-ui-foundation --strict`
- Shell/navigation route inventory tests for primary surfaces.
- Visual QA screenshots for `/`, `/login`, `/interactive-learning`, `/simulations`, `/interactive-learning/control-workbench`, `/dashboard`, `/teacher`, `/admin`, and `/knowledge` in light and dark themes.
- Focus and responsive checks for the floating action dock at desktop and 320px mobile widths.
