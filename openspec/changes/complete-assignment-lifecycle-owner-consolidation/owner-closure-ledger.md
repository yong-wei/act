# C15 owner-closure ledger

Source revision is the implementing commit on `complete-assignment-lifecycle-owner-consolidation`.

| Old path | Replacement | Owner | Preserved behavior | Deletion condition |
| --- | --- | --- | --- | --- |
| `features/ai/ai-workshop-collections.server.ts` → `submission-service.listStudentAssignments` | `studentListAssignments` public API | Assignment | Current student assignment DTO, CURRENT-only workshop tasks | Deleted this change |
| Teacher/student assignment routes → `assignment-domain` / `submission-domain` schemas | public API schema re-exports | Assignment | Same Zod bounds, CSRF, error mapping | Deleted this change |
| `rubric-guidelines/generate` → `assignment-rubric-generation` + Prisma | `teacherGenerateRubricGuidelines` | Assignment | Same request schema, rate limit, 503 unavailable | Deleted this change |
| `student/submission-objects/local-upload` → object-store + submission-domain | public API re-exports | Assignment | Local signed upload limits unchanged | Deleted this change |
| `assignment-question-catalog` → `prisma.adaptiveAssessmentItemRef` | Assessment `list/readAdaptiveAssessmentItemRef` | Assessment | Same ref identity, catalog JSONL, eligibility | Deleted this change |
| Assignment routes → Prisma / private services | already on public API | Assignment | Authoring, delivery, review, grading closure | Already zero |
| Learning Record writes from Assignment owner | none; no `learningFact.create` | Learning Record | Assignment does not write facts | N/A |

## Approved remaining ports (not persistence owners)

| Caller | Port | Why it stays |
| --- | --- | --- |
| `diagnosis-persistence` / `diagnosis-generation-preflight` | `frozen-submission-lineage` pure predicate | Documented lineage port; importing public API would pull grading/object-store into diagnosis |
| Client UI `assignment-authoring` / `assignments` | `assignment-domain`, `assignment-rubric-contract`, `submission-domain`, `student-result-presentation` | `'use client'` must not import server `public-api.ts`; C17–C19 may relocate UI contracts |
| Route guards | `assignment-route-guards` / `submission-route-guards` | Delivery adapters (auth, CSRF, parse) |
| Owner tests | private modules | Characterization of internals |

## C16 handoff (do not delete here)

See `c16-extraction-inventory.md`. Data Governance still owns concrete grading orchestration and document-grading object-store callers.
