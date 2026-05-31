## Context

Recent UI review found that the platform already has semantic tokens and role-aware shell primitives, but visual identity is still fragmented across `surface-*`, `interactive-course-hub-*`, `premium-lesson-*`, `admin-console-*`, and page-local slate/emerald/violet palettes. The commercial direction should allow bold replacement of unreasonable old shells instead of merely adapting them.

## Design Direction

The brand idea is `maritime control learning system`: a commercial-grade platform for control theory learning, simulation, Arena challenges, evidence-based personalization, and teacher governance.

Core metaphors:

- Navigation trace: learning path, vessel path, and mission flow.
- Feedback loop: control reasoning, evidence, adjustment, and reflection.
- Instrument grid: engineering workspace, evaluation, and governance.

Logo exploration should use an abstract mark derived from trace plus feedback loop, optionally with `A/C` geometry. It should not use literal ship clipart, rocket icons, generic AI sparkles, or copied crests.

## Visual System

- Palette: deep maritime base, steel-blue surfaces, navigation-cyan primary accent, muted chart blue, buoy-amber warning, subdued green/red status colors.
- Typography: use a distinctive sans display/body stack with Chinese fallbacks; numbers and metrics must use tabular figures or a mono numeric treatment.
- Surfaces: limit to canvas, panel, instrument, overlay, and status variants. Cards are no longer the default grouping primitive.
- Motion: use short transform/opacity transitions for state changes. No broad decorative motion on dense product pages.
- Texture: brand texture may use subtle chart grid, scanline, or map-grain treatments, but only as a low-contrast system layer.

## Token Bridge

The commercial brand layer should extend the existing platform semantic token model instead of adding another page-local palette. Current reusable names such as `--platform-canvas`, `--platform-surface`, `--platform-surface-raised`, `--platform-action-primary`, evidence state tokens, privacy state tokens, replay state tokens, and evaluation state tokens remain the integration points. The commercial layer adds stricter meaning:

- `canvas`: maritime command canvas, not a generic dark background.
- `surface`: steel panel, instrument panel, overlay, and evidence panel levels.
- `action`: navigation-cyan route/action emphasis and measured hover state.
- `status`: buoy amber, signal green, alarm red, and muted inactive states.
- `trace`: route line, learning path, mission path, and callback/return path.
- `grid`: instrument grid, chart grid, and report watermark logic.

Existing page-specific namespaces such as `interactive-course-hub-*`, `admin-console-*`, `premium-lesson-*`, and broad `surface-card` usage may stay during migration, but later changes should either map them to the commercial roles above or replace the shell when adaptation would preserve the wrong visual hierarchy.

## Current Surface Review

The current homepage already uses maritime scenarios and student entry routing, but also relies on large scenario gradients and multiple destination cards. The brand contract should keep the real maritime/control subject matter while requiring trace, instrument, and evidence hierarchy to carry the first viewport rather than decorative gradient or carousel density.

`/arena` is already a strong candidate for the mission/challenge interpretation of the brand. It needs the Arena badge, leaderboard status, challenge cards, and Control Workbench entry language to share the same trace-and-instrument treatment instead of becoming a separate gamified skin.

`/interactive-learning` currently mixes fuchsia, cyan, and amber accent chips across entry cards. Future migration should replace that page-local palette with commercial intent roles: learning trace, course instrument surface, component inventory, and evidence status.

`/assessment/adaptive-practice` already has actionable loading, error, unauthenticated, demo, question, and feedback states. The brand layer should make those states look like evidence confidence and guided practice instrumentation rather than AI sparkle decoration.

`/interactive-learning/control-workbench` is the clearest instrument-grid destination. Direct entry and contextual Arena entry should share the same commercial chrome, default panel logic, and trace back to the originating route when available.

`/login?callbackUrl=%2Fprofile` must preserve callback intent as a visible return trace. Login and embedded login states should not look like disconnected technical forms; they should present profile/cockpit return, brand mark, status/error state, and privacy assurance within the same commercial surface system.

Teacher/admin workspaces already contain `admin-console-*` and teacher insight shells with governance status, tables, and evidence coverage. The brand contract should preserve dense operations ergonomics and avoid turning these pages into marketing-style cards.

Report output, class review, Arena publication reports, and data center snapshots need a quiet watermark and evidence provenance treatment. The watermark must not obscure student data, metrics, formulas, charts, or exported print content.

## Brand Applications

The brand contract should include application expectations for favicon, app mark, navigation logo, login/auth panel, course badge, Arena badge, workbench instrument chrome, report watermark, and teacher/admin governance snapshot. The goal is not to finalize raster artwork in this change, but to make later implementation verify the same visual world across product, learning, and operations surfaces.

At least one brand application board or equivalent design reference should show how the mark, palette, typography, instrument surface, evidence status, and navigation treatment coexist. Without this, downstream work can satisfy the words while still looking visually unrelated.

Minimum application references:

- Favicon and compact app mark: one-color and two-color versions derived from trace plus feedback-loop geometry.
- Navigation logo: mark plus wordmark lockup for global shell and compact role shell.
- Course badge: small lesson/module badge that works on interactive-course hub and runtime pages.
- Arena badge: challenge/season badge with mission trace and score/status state.
- Workbench instrument chrome: panel header, command bar, chart frame, metric strip, and evidence rail.
- Login/auth treatment: callback path, role cockpit destination, auth error, and privacy state.
- Governance snapshot: data center/admin/teacher screenshot treatment with source marker and status legend.
- Report watermark: low-contrast mark plus trace grid that survives PDF/print/export without reducing readability.

## Boundaries

This change creates the brand contract only. It does not migrate pages, introduce new dependencies, or generate final raster assets. Later changes may replace existing UI shells when they conflict with the brand contract.

## Risks

- If the brand language remains only prose, later work can still drift. A later governance change must add source and visual checks.
- If the brand mark becomes literal maritime decoration, the platform will feel less like a commercial control system. Keep the mark abstract and scalable.

## Verification

- Strict OpenSpec validation.
- Design review against homepage, Arena, workbench, adaptive practice, and interactive lesson hub use cases before implementation begins.
- Design review against login/auth, teacher workspace, admin governance, and report-watermark use cases before implementation begins.
