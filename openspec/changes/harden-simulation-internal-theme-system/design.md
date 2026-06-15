## Context

The accepted handoff requires concept 2 command-deck pages to use translucent command surfaces and readable light/dark templates. The current audit proves that page shell migration did not enter resource-level components: panel classes, HUD text, 3D background colors, water/grid colors, and metric tiles still use local Tailwind palettes.

## Goals / Non-Goals

**Goals:**

- Provide a single simulation visual token contract for panels, HUDs, local controls, status tiles, hint strips, and scene labels.
- Provide theme-aware scene parameter presets for light and dark mode.
- Make simulation-internal styling reviewable through tests and visual evidence.
- Preserve all existing simulation behavior and telemetry semantics.

**Non-Goals:**

- No new 3D ship/platform models.
- No controller or physics tuning.
- No redesign of `/simulations` catalog information architecture.
- No one-off per-route palette fixes that bypass the shared contract.

## Decisions

- Use shared primitives rather than route-level overrides. A shared `simulationUi` theme contract or equivalent component layer should own panel, HUD, and local-tool styling so all seven simulations converge.
- Treat 3D scene parameters as part of theme acceptance. Dark mode may keep natural scene cues, but sky/water/grid/label contrast must be tuned as a coherent dark template.
- Add governance at the resource boundary. The audit failure came from nested resources, so route-level AppShell markers are insufficient.
- Keep implementation independent of numerical runtime. Theme props can flow into scene renderers, but must not alter model update loops or evidence calculations.

## Risks / Trade-offs

- [Risk] Removing local classes may change carefully tuned readability in individual simulations. Mitigation: migrate one family at a time and require per-route screenshots.
- [Risk] Scene darkening can reduce object visibility. Mitigation: define scene-object contrast checks and compare all seven detail routes.
- [Risk] Governance may report legacy debt too broadly. Mitigation: scope blocking checks to migrated simulation resources and document temporary exceptions with removal conditions.
