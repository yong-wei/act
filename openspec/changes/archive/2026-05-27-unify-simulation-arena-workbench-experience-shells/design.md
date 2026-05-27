## Context

Simulation scenes, Arena, and Control Workbench are currently connected conceptually but not visually. Future contracts make the connection explicit: standalone scenes, course-launched simulations, Arena previews, official evaluations, registered models, and replayable traces all need consistent visible boundaries.

## Goals / Non-Goals

Goals:

- Provide one product shell for Simulation Hub, scene pages, Arena pages, and Arena-bound Workbench sessions.
- Surface launch context, model relation, replay state, protocol version, evidence provenance, and official/preview boundary.
- Keep the route-level user journey stable: discover, inspect, launch, experiment, submit, compare, review.
- Preserve DB BOPPPS, `ResourceRenderer`, `InteractiveProvider`, registry configuration, and `BaseWidgetProps` behavior when simulation or Arena experiences are launched from lessons.

Non-goals:

- No physics rewrite.
- No scoring, leaderboard, model-registry, replay, or evidence algorithm changes.
- No mandatory migration of every scene before the pilot scene shell is available.
- No bypass of the lesson engine or resource registry for course-launched simulations.

## Decisions

### Make provenance visible

The shell must show whether an activity is standalone, course-launched, preview-only, or official. It must not let preview traces look like official hidden evaluation.

### Treat Workbench as the shared engineering stage

Arena, course tasks, and free exploration can change context and side panels, but the Workbench frame should remain recognizable.

### Keep course launch runtime intact

When a simulation or Arena experience is launched from a DB BOPPPS lesson item, the UI shell must preserve the existing lesson-engine chain. Shell migration can add visible provenance and status, but it cannot skip `ResourceRenderer`, `InteractiveProvider`, registry default config, `TeachingResource.config`, `LessonItem.overrideConfig`, embedded progress callbacks, or resource-level props.

## Risks

- UI migration can accidentally blur official and preview semantics. The shell must use shared status components for those boundaries.
- Simulation scenes can regress if layout migration changes runtime ownership. Scene internals stay behind SceneShell boundaries.

## Verification

- Route smoke tests for Simulation Hub to scene, Arena to challenge detail to Workbench, and course-launched simulation entry.
- Status rendering tests for standalone/course/preview/official/replay states.
- Browser checks for pilot scenes and Arena-bound Workbench after implementation.
