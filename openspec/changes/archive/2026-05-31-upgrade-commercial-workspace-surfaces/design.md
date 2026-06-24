## Context

The platform's differentiated experience lives in workspaces: students inspect control objects, adjust methods, compare traces, submit Arena results, move through interactive lesson modules, and review evidence. The current UI often frames these flows with generic panels and local page structure, which weakens the commercial product identity and can hide important charts or evidence.

## Workspace Model

A commercial workspace surface should be composed from five zones:

- Context strip: object, route source, mode, preset, class/challenge/course context, and return target.
- Command bar: primary actions, save/submit/reset, view controls, and role-specific operations.
- Instrument area: charts, diagrams, media, lesson modules, simulators, and analysis panels.
- Evidence rail: confidence, official/preview state, source coverage, learner evidence, and submission readiness.
- Support drawer: explanation, hints, Konling/AI assistance, logs, or teacher-only controls when allowed.

This model can replace old page shells or nested card stacks when they obscure the workspace hierarchy.

## Panel Behavior

Panels must keep stable dimensions and initialize meaningful defaults. A direct Control Workbench entry with a selected object and default panel configuration should show the expected chart/image panels just as a contextual Arena entry does, unless the data is genuinely unavailable. If unavailable, the panel should render a branded explanation rather than disappearing silently.

## Interactive Course Runtime

Standardized interactive course modules should use commercial module chrome instead of lesson-private UI variants. The renderer may support content-specific layouts, but module identity, answer state, feedback state, teacher release, and evidence markers should be visually consistent.

## Operations Workspaces

Teacher analytics, admin governance, data center, data-quality, and report surfaces should be treated as commercial operations workspaces. They should use the same context strip, command bar, instrument area, evidence rail, and support drawer model where applicable, with higher density and less decorative motion than student entry pages.

These surfaces should not remain visually separate back-office pages after the student-facing redesign. Their commercial quality should come from clear hierarchy, stable metric alignment, governed evidence state, and efficient repeated use rather than oversized marketing composition.

## Risks

- Workspace redesign can break task flow if visual polish outruns controls. Command hierarchy must remain direct.
- If default panels are over-eager, unsupported contexts may show misleading charts. Availability must remain domain-owned and explicit.
- Operations workspaces can become too spacious if student-entry visual patterns are copied directly. They need denser instrument layout while sharing the same brand system.

## Verification

- Direct and contextual Control Workbench entry checks.
- Arena challenge detail to workbench flow checks.
- Interactive course runtime sample checks across canonical module classes.
- Teacher/admin operations workspace checks for dense metrics, governed state, and repeated task ergonomics.
- Visual checks for stable panel dimensions, first meaningful instrument panel, and evidence state placement.
