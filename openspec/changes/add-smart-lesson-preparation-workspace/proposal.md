## Why

The contest smart-preparation scenario spans teacher-owned sources, text lesson-plan generation, fixed-layout interactive courseware, publication into classroom runtime, and PDF export. Treating all of that as one executable change would create a 61-task, five-capability, high-risk review unit, so this change becomes the tracking contract for a dependency-ordered Buddy series.

## What Changes

- Establish one shared product boundary and acceptance scenario for the smart-preparation series.
- Coordinate six independently claimable, testable, reviewable, and deliverable child changes.
- Permit the course-basis and slide-runtime foundations to proceed independently before converging in the courseware editor.
- Keep P1 PDF export separate from the P0 generate-review-publish-run chain.
- Track the contest-wide natural-language multi-turn, source-quality, user-feedback, and material-rights evidence that no individual implementation child can establish alone.

The child changes are:

1. `add-teacher-course-basis-management`
2. `add-smart-lesson-plan-authoring`
3. `standardize-generated-courseware-slide-runtime`
4. `add-smart-courseware-generation-editor`
5. `publish-smart-courseware-to-classroom`
6. `export-smart-courseware-pdf`

## Capabilities

### New Capabilities

- `smart-lesson-preparation-series`: defines the tracking-only child inventory, dependency graph, and completion rule. Executable product capabilities remain owned by the child changes.

### Modified Capabilities

- None. Existing capability deltas are owned by the relevant child change.

## Impact

- This parent is a Buddy `type:series-parent` tracking record and SHALL NOT be claimed for product implementation.
- Cross-child terminology, architecture decisions, exclusions, and final contest acceptance remain coordinated by `CONTEXT.md`, ADRs 0001–0014, and this series design.
- Each child has its own OpenSpec artifacts, Buddy Issue, claim branch, tests, review, PR, and archive lifecycle.
