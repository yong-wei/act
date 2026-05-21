## 1. Implementation

- [ ] 1.1 Add Arena training metadata types and labels.
- [ ] 1.2 Populate all current challenge tasks with capability tags, prerequisites, stage, estimated effort, hidden-test visibility, and common failure points.
- [ ] 1.3 Build selectors for training stages, capability groups, and next-challenge candidates.
- [ ] 1.4 Update Arena hall to show a training map while preserving existing filters.
- [ ] 1.5 Update challenge detail to show training goals, prerequisites, and common failure points.

## 2. Tests

- [ ] 2.1 Add domain tests that require complete training metadata for every challenge.
- [ ] 2.2 Add hall/detail rendering tests for stage grouping and challenge metadata.

## 3. Verification

- [ ] 3.1 Run targeted Arena tests.
- [ ] 3.2 Run `npm run lint`.
- [ ] 3.3 Run `npm run build` if route or shared UI code changes.

## 4. Coordination

- [ ] 4.1 This is the foundation change for the Arena Pro series.
- [ ] 4.2 Do not implement workbench flow, feedback, badges, teacher reports, or growth recommendation in this change.
