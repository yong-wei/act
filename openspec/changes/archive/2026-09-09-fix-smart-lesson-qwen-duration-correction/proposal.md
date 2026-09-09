# Proposal: Fix Qwen SmartLesson Duration Correction

## Why

The real SiliconFlow/Qwen3.5 SmartLesson smoke path can reach the provider and
complete earlier stages, but a BOPPPS stage can still fail after correction
when the sum of nested step minutes does not equal the stage duration.

## What Changes

- Upgrade the SmartLesson generation prompt version.
- Add explicit duration planning and pre-output arithmetic checks to stage
  generation prompts.
- Include a concrete, deterministic step-minute allocation in targeted
  correction context when the original output exposes its step count.
- Preserve the existing schema, deterministic gates, provider/model, and
  single-correction lifecycle.

## Non-Goals

- Do not change the provider or model.
- Do not relax the BOPPPS schema or duration gates.
- Do not add retries, resume behavior, or formal experiment data.
