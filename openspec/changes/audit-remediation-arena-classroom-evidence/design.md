## Context

The audit confirms Arena publication and classroom submission data can exist, but the product does not explain result rules or writeback consistently. Classroom flows also need clearer code errors, release/submit/end states, and post-class recovery.

## Goals / Non-Goals

**Goals:**
- Explain Arena score and ranking semantics to students and teachers.
- Make evidence writeback observable for Arena and classroom submissions.
- Make classroom code, release, submit, and end states accessible and recoverable.

**Non-Goals:**
- Do not redesign Arena scoring algorithms beyond explaining and enforcing visible policy.
- Do not rebuild every interactive lesson module.

## Decisions

- Arena submissions must expose which attempt counts for ranking and why.
- Late and zero-score submissions must be labeled without being misclassified as excellent.
- Classroom session state should be authoritative across student, teacher, and review routes.

## Risks / Trade-offs

- Evidence writeback can duplicate records if not keyed. Mitigation: require sourceEvent/session/task identifiers and duplicate handling.
- Changing ranking labels can affect teacher expectations. Mitigation: keep raw score details available with clearer product labels.
