## Context

The confirmed design direction asks for semi-transparent top, side, control, and bottom panels with deep/light parity. Existing brand specs already define Instrument Atlas, night-bridge, daylight engineering chart, and token-governed surfaces. This change applies those rules specifically to virtual simulation.

## Goals / Non-Goals

**Goals:**

- Define simulation-specific light and dark templates.
- Use platform semantic tokens for panels, toolbar, buttons, text, borders, status, evidence, and replay.
- Keep 3D scene colors natural while shell chrome follows the active template.
- Prevent generic one-note dark/navy or white-card surfaces.

**Non-Goals:**

- Generate new imagery or 3D assets.
- Redesign global logo or brand mark.
- Implement route governance checks; that is the final QA change.

## Decisions

### 1. Light and dark are separate templates

Light mode should feel like daylight engineering chart/instrument paper; dark mode should feel like a night bridge. They share geometry but not simple inverted colors.

Alternative considered: invert existing dark shell colors for light mode. That yields low-quality white-card administration styling.

### 2. Simulation chrome is translucent but token-governed

Top, side, control, and bottom panels may use glass-like translucency, but all text, borders, buttons, and status accents must come from governed tokens.

Alternative considered: raw rgba overlays per page. That repeats the current page-local palette problem.

### 3. Scene color and shell color are separated

The 3D scene may keep domain-specific water, ship, grid, or environment colors, while UI chrome remains governed.

Alternative considered: force scene colors into global tokens. That can harm simulation realism and is unnecessary for UI consistency.

## Risks / Trade-offs

- Translucent panels can reduce contrast. Mitigation: define contrast thresholds and fallback opacities.
- Scene backgrounds can clash with shell chrome. Mitigation: require per-theme screenshots and nonblank scene checks.
- Status tokens may be overused decoratively. Mitigation: restrict them to state and evidence roles.

## Migration Plan

1. Define simulation theme roles and map them to existing platform/commercial tokens.
2. Apply templates to catalog, shell chrome, toolbar, panels, hints, and mission task surfaces.
3. Remove raw local palette classes from migrated simulation surfaces.
4. Capture light/dark evidence across representative pages.

## Open Questions

- Whether simulation scene grid colors should remain feature-owned or use a chart-data token adapter.
