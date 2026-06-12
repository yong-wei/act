## Context

The platform has several local shells: AppShell, ArenaPageShell, teacher layout, admin headers, and feature page navigation. AppShell should become the platform runtime shell, while dense workspace behavior should be expressed as archetype variants and zones.

## Goals / Non-Goals

**Goals:**

- Make AppShell render canonical archetype variants from route ledger metadata.
- Add shared slots for context header, main stage, status rail, support drawer, context strip, command bar, instrument area, and evidence rail.
- Move floating action dock ownership to the platform shell.
- Keep shell primitives presentation-focused and domain-agnostic.

**Non-Goals:**

- Rewriting all legacy pages in one change.
- Moving business state calculation into `src/components`.
- Changing provider, evidence, path, or report data models.

## Decisions

### Decision 1: AppShell consumes contracts, not feature modules

Feature domains should adapt their data into shell DTOs. AppShell should not import feature implementation modules to compute truth.

### Decision 2: Workspace zones are shared contracts

The existing zone vocabulary from the simulation arena workbench contracts should inform AppShell slots so Control Workbench and Arena do not need a second shell language.

### Decision 3: Floating dock is shell-owned

Global Konling, management, settings, and support controls should render through shell-owned dock primitives. Page-local fixed controls need migration adapters or retirement metadata.

## Validation

- AppShell unit tests cover archetype variant selection and required slots.
- Route-ledger integration tests verify breadcrumbs, return targets, dock behavior, and theme support are route-derived.
- Boundary checks verify AppShell does not import feature orchestration modules.
- `rtk openspec validate upgrade-platform-app-shell-to-archetype-shell --strict` passes.
