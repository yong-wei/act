## Context

The current Konling runtime has path-aware coaching, but the accepted adaptive path center requires a stronger interaction model: the student clicks `生成学习路径`, provides parameters or natural language, and Konling calls governed tools to generate options and return them to the page. That requires write-capable tool governance, not just chat advice.

## Goals / Non-Goals

**Goals:**

- Add path-generation, revision, selection, rejection, and explanation tools.
- Scope tools to the authenticated learner, route context, class/course/path permissions, and privacy policy.
- Persist tool runs before side effects and make repeats idempotent.
- Return structured path options to the page for visual comparison.

**Non-Goals:**

- No teacher grading or prep-pack tool expansion.
- No hidden autonomous publishing.
- No separate Konling side panel; visual placement remains the shared dock.

## Decisions

- Use server-owned path-center context as the tool input base. Client text can express intent but cannot expand target user, goal, class, resource, or path scope.
- Treat path generation as a state-changing tool with idempotency. Repeated clicks with the same request should not create duplicate path rounds.
- Split tools by operation: generate, revise, select, reject, explain, and record outcome. This keeps audit and approval policy precise.
- Return structured option summaries and evidence boundaries to UI, not prose-only chat responses.

## Risks / Trade-offs

- Tool side effects could create duplicate or conflicting paths. Mitigation: require idempotency keys and active-path conflict policy.
- Natural language goals may be vague. Mitigation: map them to registered goals or return bounded clarification choices with starter-path fallback.
- Konling could expose internal diagnostics. Mitigation: require redacted output summaries and student-safe response contracts.
