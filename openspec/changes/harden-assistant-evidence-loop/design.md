## Context

Archived specs already define governed indicators, role-specific diagnosis, RAG chunk provenance, and Konling teaching-assistant modes. Code also includes `DiagnosisSurfacePanel`, `verifyLearningEvidenceCitations`, and `buildKonlingTeachingAssistantRuntimeContract`. The gap is not the absence of contracts; it is that the contracts must be wired into a visible, route-level evidence loop.

## Goals / Non-Goals

**Goals:**

- Make the diagnosis-report evidence basis wide enough for the competition story.
- Make evidence drilldowns and CitationChip-style payloads reusable across assistant surfaces.
- Make Konling mode readiness observable before and during chat.
- Preserve student/teacher/admin privacy projection.

**Non-Goals:**

- No new mastery model or path planner algorithm.
- No LLM grading evaluator upgrade.
- No final visual design polish.
- No raw private learner evidence in student-visible prompts or citations.

## Decisions

- Treat evidence as a shared surface contract, not a local component detail. Diagnosis, grading feedback, path advice, and Konling should reuse the same citation payload semantics.
- Keep diagnosis observation storage additive. Existing `DiagnosisReportSnapshot` JSON may be used initially, but the implementation must expose stable dimension, indicator, confidence, window, limitation, and evidence references for drilldown.
- Use mode readiness as a route contract. Konling entry points should show `ready`, `degraded`, or `unavailable` from server-verifiable context rather than optimistic client hints.
- Keep citation failure visible. Missing or low-authority evidence should degrade the answer or surface a fallback message rather than silently generating an unsupported explanation.

## Risks / Trade-offs

- Evidence mappers can overfit the demo seed -> require source-family coverage and low-evidence degraded states.
- Shared citation UI may expose restricted evidence -> enforce role-projected payloads before rendering.
- Mode readiness could become noisy if every missing optional field degrades the mode -> only required context blocks readiness; optional gaps become explanation text.
