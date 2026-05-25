## Context

`src/lib/resource-registry.tsx` currently supports `SIMULATION_APP`, but only the lesson 13 cruise typhoon simulation is registered as a course simulation app. The standalone `/simulations/*` catalogue and Arena workbench need a course-resource adapter layer rather than direct component paths in lesson plans.

## Goals

- Make eligible simulations launchable from DB BOPPPS lesson items.
- Allow lesson configuration to select scene/task id, launch mode, telemetry policy, and governance context.
- Preserve standalone browsing and existing routes.
- Ensure course-launched activity can create learning evidence with class/session context.

## Non-Goals

- No rewrite of all scene internals.
- No replacement of preset lesson architecture.
- No recommendation engine implementation.
- No removal of standalone `/simulations` navigation.

## Design

Resource registration should expose stable ids for simulation scenes and Arena workbench/challenge activities. `TeachingResource.config` and `LessonItem.overrideConfig` should pass scene id, scenario id, Arena task id, launch mode, telemetry policy, and governance context.

Config resolution must follow the platform course-resource rule: registry default config, then `TeachingResource.config`, then `LessonItem.overrideConfig`. Launch context should be normalized before reaching the resource so standalone launches carry standalone provenance and course launches carry available course, class, session, lesson item, and publication identifiers.

The renderer should resolve registry entries and launch the correct simulation or Arena experience without lesson plans importing component paths. Standalone routes should continue to work and may reuse the same `SceneSpec` resolution when available.

Evidence emission should attach course/class/session context when launched from a lesson and standalone context when launched from `/simulations`.

`SIMULATION_APP` resources that are launched from the lesson engine should participate in the same progress/completion event boundary as other response-producing resources when the underlying simulation reports completion.

## Risks

- Registering every route too early can expose immature scenes as course assets. Eligibility should be explicit.
- Course launch context can be lost if standalone and course paths diverge. Keep launch context normalized.

## Verification

- Registry tests or smoke checks for configured simulation resource ids.
- Lesson render tests for `SIMULATION_APP` with override config.
- Evidence event tests for course/class/session context.
- Gate with `rtk proxy openspec validate register-simulations-as-course-resources --strict`.
