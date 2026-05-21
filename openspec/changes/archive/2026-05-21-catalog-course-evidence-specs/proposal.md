## Why

Teacher review, submission gates, evidence browsing, and post-class reports need a single course evidence specification instead of hard-coded unit-specific state kinds and step ids.

## What Changes

- Add a CourseEvidenceSpec registry and manifest-derived generator.
- Support centralized overrides for legacy or special lessons.
- Register 5-3 through 5-6 pre, post, summary, and student state mappings from the production investigation.
- Expose response-producing, objective, parameter, and summary step lookup helpers.

## Capabilities

### New Capabilities

- `course-evidence-specs`

### Modified Capabilities

- None.

## Impact

- src/lib/data-governance or src/features/interactive shared registry
- course-content/runtime/lessons/*/interactive-manifest.json consumers
- teacher review and gate tests
