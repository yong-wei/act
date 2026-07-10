## Why

The platform can grade isolated subjective documents, but it has no first-class assignment object that teachers can author, version, publish, and bind to classes. Formal assignment authoring must exist before student delivery and AI-assisted grading can become a reliable product workflow.

## What Changes

- Add a durable assignment lifecycle with draft, published revision, audience, question snapshot, schedule, late policy, and resubmission policy.
- Add teacher assignment list and editor surfaces, including manual question authoring and governed question-bank selection.
- Make every assignment question explicitly define a prompt, reference answer, point value, and versioned analytic rubric.
- Snapshot selected question content, answer, rubric, and source lineage so later question-bank edits cannot mutate a published assignment.
- Block publication when assignment total, question totals, or rubric criterion totals disagree instead of silently rescaling scores.
- Add the teacher `作业` operation entry and `新建作业` action through central role-navigation contracts.

## Capabilities

### New Capabilities
- `assignment-authoring-and-publication`: Defines first-class assignment authoring, immutable publication revisions, class audiences, question/rubric snapshots, publication validation, and teacher management surfaces.

### Modified Capabilities
- `platform-role-navigation`: Adds assignment management to teacher operation navigation without changing the global student-first module order.

## Impact

- Affects Prisma assignment, revision, audience, and question-snapshot models plus migrations and authorization policy.
- Affects teacher dashboard navigation, assignment routes, question editor, question-bank picker, and publication APIs.
- Consumes the governed assessment-item catalog without weakening its review, lineage, or eligibility states.
- Establishes the upstream domain contract required by the remaining assignment delivery and grading changes in this series.
