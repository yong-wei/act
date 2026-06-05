## Context

Browser review and design-skill analysis show that the current visual language is too dependent on dark blue/cyan surfaces, Lucide iconography, and bordered cards. This change builds the visual substrate before route migration: a usable brand kit plus tokens that let pages look different by archetype while staying in one system.

## Goals / Non-Goals

**Goals:**

- Define and implement light/dark templates as separate visual modes.
- Produce reusable brand assets and rules for app mark, logo lockup, route badges, report watermark, and evidence snapshot treatments.
- Replace page-local color families with governed roles.

**Non-Goals:**

- Do not redesign page layouts in this change.
- Do not change route behavior, authentication, data models, or course content.

## Decisions

### Decision 1: Light mode is "paper editorial"

Light mode should feel like engineering chart paper: matte canvas, fine grid traces, high readability, restrained panels, and evidence stamps. It must not degrade into generic white admin cards.

### Decision 2: Dark mode is "instrument cinematic"

Dark mode should feel like a night bridge or control desk: near-black canvas, layered instruments, controlled trace illumination, and clear signal states. It must not remain a one-note navy/cyan card theme.

### Decision 3: Brand assets are product infrastructure

Logo, favicon, route badges, instrument chrome, and watermark references are required inputs for page migration, not optional decoration.

## Risks / Trade-offs

- Icon replacement can create broad churn. -> Start with governed wrappers and route-critical icons before replacing all Lucide usage.
- Brand assets can become ornamental. -> Require every asset to map to navigation, evidence, route identity, instrument, or report usage.
