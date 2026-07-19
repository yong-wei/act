## Why

Once teacher-owned course evidence is available, the platform needs a complete reviewable BOPPPS teaching design before it can safely generate courseware. Existing prep packs only enhance an existing lesson and do not create an immutable lesson-plan revision.

## What Changes

- Add single-lesson setup, knowledge-point selection, confirmed goals, duration, and optional aggregate class context.
- Reuse the existing Konling session API and `prep-coauthor` mode for natural-language task creation, ambiguity clarification, and multi-turn constraint revision against the same structured task.
- Generate a complete text BOPPPS lesson plan progressively through durable, resumable, idempotent structured-output jobs.
- Reuse Provider Registry, `lesson-design` Source Packs, SAR candidate expansion, and citation verification.
- Add teacher editing, optional advisory AI review, deterministic plan checks, approval, and sequential immutable plan revisions.

## Capabilities

### New Capabilities

- `smart-lesson-plan-authoring`: source-grounded single-lesson setup, staged generation, review, approval, provenance, privacy, and immutable plan revisions.

### Modified Capabilities

- `konling-agent-runtime`: mount the existing teacher `prep-coauthor` mode on the smart-preparation workspace with server-owned task context and draft-only confirmed updates.

## Impact

- Depends on `add-teacher-course-basis-management`.
- Adds task/job/revision persistence, BullMQ worker paths, Provider audit, Konling smart-prep context integration, teacher authoring UI/API, and privacy/state-machine tests.
- Does not generate or publish interactive courseware.
