# Tasks: Qwen SmartLesson Duration Correction

## Implementation

- [x] Add explicit duration planning and arithmetic self-check instructions to
  SmartLesson stage requests.
- [x] Add deterministic duration allocations to targeted correction context.
- [x] Preserve generic correction behavior when the allocation cannot be
  derived.
- [x] Bump the generation prompt version to `smart-lesson-plan.v3`.

## Verification

- [x] Add worker regression coverage for initial duration instructions.
- [x] Update targeted correction assertions for the v3 prompt and allocation.
- [ ] Run a real-provider smoke after merge using the unchanged Qwen3.5
  experiment conditions.
