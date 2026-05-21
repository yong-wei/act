## Why

Evidence summaries are score-ranked and truncated, so newer 5-1 and 5-2 evidence can be hidden behind older high-score facts such as 4-4. Students and teachers also lack full evidence browsing beyond snapshot snippets.

## What Changes

- Extend evidence summary items with time, quality, lesson, session, step, and question summary metadata.
- Sort evidence newest-first by startedAt and createdAt.
- Add student and teacher paginated LearningFact evidence APIs.
- Update growth, teacher student detail, and diagnosis views to link to full evidence browsing.

## Capabilities

### New Capabilities

- `evidence-timeline-browser`

### Modified Capabilities

- None.

## Impact

- src/lib/data-governance/competency-engine.ts
- src/app/api/student/evidence
- src/app/api/teacher/classes/[classId]/students/[studentId]/evidence
- growth and teacher diagnosis pages
