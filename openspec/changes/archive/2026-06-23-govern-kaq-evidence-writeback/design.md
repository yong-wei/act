## Evidence Classes

Evidence writeback should classify sources before updating overlays:

- `instructional-checkpoint`: exercises, quizzes, checkpoint answers, approved rubric criteria.
- `path-execution`: completion, deviation, fallback, helpfulness, selection outcomes.
- `simulation-preview`: exploratory simulation runs and workbench previews.
- `simulation-validation`: governed simulation validation records.
- `arena-preview`: practice or late/non-official Arena context.
- `arena-official`: official Arena evaluation records.
- `konling-intervention`: governed tool run or intervention outcome, not raw assistant prose.
- `teacher-approved-grading`: reviewed rubric or grading workflow output.

## Routing

Writeback should route evidence by semantic target:

- knowledge evidence: concept correctness, terminology, prerequisite recall, section/checkpoint understanding;
- capability evidence: analysis, design, simulation validation, engineering reasoning, transfer;
- quality evidence: evidence integrity, reflection, safety, collaboration, AI-use responsibility, teacher-approved rubric outcomes.

One source may contribute to multiple target types, but each contribution must carry its own confidence and limitation metadata.

## Authority And Limits

Preview evidence can support low-confidence or context states, but it must not satisfy terminal validation unless a policy explicitly allows preview validation. Official Arena and governed simulation validation can satisfy terminal validation only when version refs, scope, and evidence quality pass validation.

Konling raw narrative is never high-confidence mastery evidence. A governed tool run or intervention outcome may become evidence after materialization and privacy projection.

## Audit

Every production writeback should produce an audit record with source refs, target K/A/Q ids, version refs, confidence, limitation codes, AI-generated flag, materializedAt, actor/service, and privacy scope.

## Boundaries

This change governs materialization and writeback. It does not define the assistant graph context, ResourceNode ranking, CP-SAT repair, or teacher-facing prep-pack loop.
