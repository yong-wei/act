## Context

The repository has legacy `Mission`/`UserProgress` records, governed adaptive-assessment item sources, Arena publications, and a document-rubric grading service. It does not have a durable `Assignment` aggregate. The current document submission API treats a teaching resource as an assignment and stores workflow details in generic JSON, so it cannot reliably support publication revisions, class audiences, question-level snapshots, or later grading.

This change establishes the upstream assignment domain. It must preserve the governed question-catalog contract, use the central teacher navigation model, and avoid coupling publication to document conversion or AI grading.

## Goals / Non-Goals

**Goals:**

- Model assignment identity, mutable drafts, immutable published revisions, audiences, question snapshots, schedules, and policies.
- Give teachers a production assignment list and editor with explicit prompt, answer, points, and analytic rubric per question.
- Reuse reviewed question sources without letting later source edits mutate a published assignment.
- Prevent invalid point and rubric totals from being published.
- Establish authorization and API contracts required by downstream student submission and grading changes.

**Non-Goals:**

- Student answering or upload flows.
- Document conversion, AI evaluation, teacher grading, or student feedback.
- Replacing the adaptive-assessment catalog or legacy Mission model.
- Importing historical assignments from external platforms.

## Decisions

### 1. Use a first-class relational assignment aggregate

Introduce stable assignment identity and relational lifecycle records rather than extending `LearningEvidenceDraft` or `TeachingResource.config`.

- `Assignment` owns stable identity, author, course context, and lifecycle state.
- `AssignmentRevision` owns title, instructions, schedule defaults, total points, policy snapshot, version, and publication state.
- `AssignmentAudience` binds a published revision to authorized classes.
- `AssignmentQuestion` owns order, response type, points, prompt snapshot, answer snapshot, rubric snapshot, source lineage, and content hash.

Generic JSON remains appropriate for immutable rubric content, but workflow identity, ownership, state, and relationships remain queryable relational fields.

Alternative rejected: storing the entire workflow in one JSON draft is faster initially but weakens authorization, indexing, migrations, idempotency, and historical audit.

### 2. Freeze publication revisions

Teachers edit one draft revision. Publishing validates and freezes that revision atomically. Later edits create a new draft revision; existing submissions remain bound to the version originally published to their audience.

Alternative rejected: mutating the current assignment in place makes historical grading and resubmission evidence impossible to reproduce.

### 3. Snapshot question and rubric content

Question-bank selection stores source family, source id or file anchor, source hash, review state, and the full prompt/answer/rubric snapshot. Manual questions use the same snapshot schema with an authoring source marker.

The rubric snapshot contains stable criterion ids, labels, maximum points, observable evidence, performance levels, feedback guidance, and rubric schema version. Published questions never read live source content at grading time.

### 4. Treat score consistency as a publication gate

Publication must verify:

1. assignment total equals the sum of question points;
2. each question's points equal the sum of rubric criterion maximums;
3. rubric levels remain within their criterion maximum;
4. required prompt, answer, and rubric fields are present.

The teacher receives a blocking reconciliation view; the server does not silently normalize or rescale values. This is required because current T1-1 source artifacts expose conflicting 10, 20, and 25 point interpretations.

### 5. Keep teacher authoring compact and route-owned

Add `/teacher/assignments`, `/teacher/assignments/new`, and `/teacher/assignments/[assignmentId]/edit` as operations-console routes. The editor uses a left question outline, central question editor, and sticky preview/save/publish actions. Each question presents three primary regions: `题面`, `参考答案`, and `评分标准`.

Question-bank selection consumes the existing governed catalog and exposes source, type, knowledge, difficulty, review, rubric-readiness, and version filters. Source items that lack a usable answer or rubric may be visible but cannot be published without teacher completion and a new assignment-owned snapshot.

### 6. Authorize by teacher ownership and audience control

Only authorized teachers may create or modify assignments for their course/class scope. Publishing validates that every audience class is owned or managed by the teacher. Read APIs return only role-appropriate fields; reference answers and rubric internals are never included in student pre-submission payloads.

Audience records freeze the assignment delivery scope, but they do not grant perpetual document access to every future class member or teacher. New assignment delivery uses current membership. A student's historical access to their own assigned revision and submission uses the frozen student/assignment ownership record. Teacher review of historical submissions requires a current explicit assignment-review grant or an audited transfer; a newly assigned class teacher does not automatically inherit prior student documents. Class closure makes existing assignment history read-only, and audience removal never cascades into submission deletion.

Reference answers and teacher-only rubric guidance remain private by default even after grading. Any student solution publication must use a separate versioned `solution-release policy` scoped by assignment revision, audience, and release time.

### 7. Define referential and mutation-security contracts before migration

Prisma relations follow an explicit lifecycle matrix:

- assignment deletion is soft archival once a published revision exists;
- published revisions, questions, audiences, and source snapshots use restrictive relations and cannot cascade away from submissions;
- draft-only revisions may be hard-deleted when no audience, submission, or audit reference exists;
- downstream submissions retain immutable assignment/revision/question ids and hashes even when display metadata is later anonymized;
- retention jobs, rather than Prisma cascades, remove content objects and write tombstones or anonymization audit.

Every state-changing route uses authenticated non-GET requests, strict Origin/CSRF checks, runtime schemas, bounded strings/enums/body sizes, resource authorization, idempotency where applicable, and rate or quota controls. Page-level authorization is not accepted as an API security boundary.

## Risks / Trade-offs

- [Existing question sources have inconsistent schemas] → Normalize only into assignment snapshots and preserve source warnings; do not mutate catalog sources in this change.
- [Published revisions increase row count] → Index assignment, revision state, audience, and created/published timestamps; retain immutability for audit value.
- [Two UI sources can edit the same draft] → Use revision version or updated-at optimistic concurrency and return an explicit conflict state.
- [Teacher navigation may conflict with broader UI migration] → Add the route through central navigation inventory and preserve the global first-level order.
- [A class schedule changes after publication] → Store assignment schedule and audience publication state explicitly; do not derive historical deadlines from mutable class metadata.
- [Historical class membership changes] → Separate current delivery authorization from frozen student ownership and explicit historical teacher review grants.
- [Complex authoring is unusable on phones] → Support full authoring from 768px upward; at 320/375px provide assignment status and a clear continue-on-tablet/desktop path rather than a broken editor.

## Migration Plan

1. Add nullable-safe assignment tables, indexes, enums, referential actions, archival/anonymization fields, and authorization helpers.
2. Add draft CRUD and publication validation APIs behind an assignment-authoring feature flag.
3. Add teacher list, editor, question picker, and navigation entry.
4. Seed an explicit development fixture from T1-1 without treating the sample student's document as repository data.
5. Enable authoring after migration, authorization, score-gate, mutation-security, empty/error state, responsive, and route tests pass.

Rollback disables the feature flag and teacher navigation entry while retaining newly created draft data. Published revisions must not be destructively rolled back after downstream submissions exist.

## Open Questions

No product decision is blocking this change. Exact Prisma model names and rubric JSON schema version may be finalized during implementation while preserving the contracts above.
