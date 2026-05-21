## 1. Implementation

- [x] 1.1 Add Arena training metadata types and labels.
- [x] 1.2 Populate all current challenge tasks with capability tags, prerequisites, stage, estimated effort, hidden-test visibility, and common failure points.
- [x] 1.3 Build selectors for training stages, capability groups, and next-challenge candidates.
- [x] 1.4 Update Arena hall to show a training map while preserving existing filters.
- [x] 1.5 Update challenge detail to show training goals, prerequisites, and common failure points.

## 2. Tests

- [x] 2.1 Add domain tests that require complete training metadata for every challenge.
- [x] 2.2 Add hall/detail rendering tests for stage grouping and challenge metadata.

## 3. Verification

- [x] 3.1 Run targeted Arena tests.
- [x] 3.2 Run `npm run lint`.
- [x] 3.3 Run `npm run build` if route or shared UI code changes.

## 4. Coordination

- [x] 4.1 This is the foundation change for the Arena Pro series.
- [x] 4.2 Do not implement workbench flow, feedback, badges, teacher reports, or growth recommendation in this change.
