## Context

Current `createDraftRubricGrading` finds an evidence block and selects the middle rubric level. That is useful for proving the workflow, but it is not a professional evaluator. The implementation already has MarkItDown conversion, persisted drafts, teacher approval, student feedback, and writeback preview; this change upgrades the judgment layer and its quality metrics.

## Goals / Non-Goals

**Goals:**

- Define a control-correction rubric v1 with evidence requirements and writeback mapping.
- Add a draft evaluator contract that validates structured output before persistence.
- Preserve teacher approval as the only path to student-visible feedback and writeback.
- Record quality metrics such as teacher override rate and AI/teacher score delta.

**Non-Goals:**

- No autonomous final grading without teacher approval.
- No high-stakes gradebook integration.
- No raw document content exposure to students other than their own feedback.
- No final visual redesign of the workbench beyond workflow-critical states.

## Decisions

- Use an evaluator adapter boundary rather than hard-coding one model provider. This keeps the workflow compatible with OpenAI-compatible providers and deterministic test doubles.
- Validate evaluator output before saving. Invalid JSON, missing evidence anchors, unsupported criterion ids, or unsafe comments must produce a blocked draft state rather than partial writeback.
- Keep teacher edits first-class. The system should store both AI draft and teacher-approved values so effect reports can measure override rate and consistency.
- Link feedback to remediation actions without treating feedback display as mastery evidence. Mastery changes only after approved writeback or subsequent learner action.

## Risks / Trade-offs

- LLM grading may be inconsistent -> schema validation, rubric anchors, deterministic test fixtures, and teacher approval reduce risk.
- Formula and chart recognition may be partial after conversion -> evaluator must expose limitations and lower confidence when source precision is block-level.
- Quality metrics can be overclaimed -> effect reports must identify sample size, synthetic state, source window, and exclusions.
